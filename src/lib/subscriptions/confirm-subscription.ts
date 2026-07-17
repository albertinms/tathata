import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { subscriptions } from "@db/schema";

import { alterPeriodStatus, verifyPeriodNotification } from "@/lib/payments/newebpay";

// 连续几期授权失败后主动终止委托（藍新本身会自动继续尝试后续各期，不会因单期失败自动停止，
// 见 .claude/specs/T3.1-T3.2-newebpay-spec.md 2.4 节关键行为）
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * 处理藍新每期授权完成通知 [NPA-N050]，取代原本 T3.3 设计的主动 Timer Trigger 轮询扣款，
 * 见 spec 2.4 节：本专案改为被动接收通知＋统计连续失败次数，达门槛时主动呼叫终止委托 API。
 */
export async function confirmSubscriptionNotification(payload: { Period?: string }) {
  const verified = verifyPeriodNotification(payload);
  if (!verified.valid || !verified.result) {
    return { ok: false as const, reason: "无法解密通知内容" };
  }

  const { MerchantOrderNo, PeriodNo, TradeNo, NextAuthDate, AlreadyTimes, TotalTimes } =
    verified.result;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.newebpayMerOrderNo, MerchantOrderNo))
    .limit(1);
  if (!subscription) {
    return { ok: false as const, reason: `找不到对应订阅：${MerchantOrderNo}` };
  }
  if (subscription.status === "canceled") {
    // 委托已终止，理论上不该再收到通知（可能是终止前已排定的一期），不更新状态
    return { ok: true as const, subscriptionId: subscription.id };
  }

  const isSuccess = verified.status === "SUCCESS";

  if (isSuccess) {
    await db
      .update(subscriptions)
      .set({
        status: "active",
        newebpayPeriodNo: PeriodNo,
        newebpayTradeNo: TradeNo,
        newebpayNextAuthDate: NextAuthDate,
        newebpayAlreadyTimes: AlreadyTimes,
        newebpayTotalTimes: TotalTimes,
        nextBillingDate: NextAuthDate,
        lastPaymentAt: new Date(),
        retryCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));
    return { ok: true as const, subscriptionId: subscription.id };
  }

  const nextRetryCount = subscription.retryCount + 1;
  if (nextRetryCount >= MAX_CONSECUTIVE_FAILURES) {
    // 达连续失败上限，主动终止委托（藍新不会自动因失败停止，需商店主动喊停，见 spec 2.4／2.5 节）
    if (subscription.newebpayPeriodNo) {
      await alterPeriodStatus({
        merOrderNo: subscription.newebpayMerOrderNo,
        periodNo: subscription.newebpayPeriodNo,
        alterType: "terminate",
      });
    }
    await db
      .update(subscriptions)
      .set({ status: "canceled", retryCount: nextRetryCount, canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));
    return { ok: true as const, subscriptionId: subscription.id, terminated: true };
  }

  await db
    .update(subscriptions)
    .set({ status: "past_due", retryCount: nextRetryCount, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscription.id));
  return { ok: true as const, subscriptionId: subscription.id };
}
