import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { subscriptions } from "@db/schema";

import { alterPeriodStatus } from "@/lib/payments/newebpay";

export class SubscriptionNotFoundError extends Error {}
export class SubscriptionNotCancelableError extends Error {}

/**
 * 使用者主动取消订阅。终止委托（terminate）为不可逆动作，见
 * .claude/specs/T3.1-T3.2-newebpay-spec.md 2.5 节：终止后无法再次启用。
 */
export async function cancelSubscription(params: { subscriptionId: string; userId: string }) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, params.subscriptionId))
    .limit(1);
  if (!subscription || subscription.userId !== params.userId) {
    throw new SubscriptionNotFoundError(`找不到订阅 ${params.subscriptionId}`);
  }
  if (subscription.status !== "active" && subscription.status !== "past_due" && subscription.status !== "pending") {
    throw new SubscriptionNotCancelableError(`订阅状态为 ${subscription.status}，无法取消`);
  }

  if (subscription.newebpayPeriodNo) {
    const result = await alterPeriodStatus({
      merOrderNo: subscription.newebpayMerOrderNo,
      periodNo: subscription.newebpayPeriodNo,
      alterType: "terminate",
    });
    if (result.Status !== "SUCCESS") {
      throw new Error(`藍新终止委托失败：${result.Status} ${result.Message}`);
    }
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.id, params.subscriptionId))
    .returning();

  return updated;
}
