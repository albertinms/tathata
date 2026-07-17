import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { purchases } from "@db/schema";

import { verifyMpgNotification } from "./newebpay";

/**
 * 处理藍新 NotifyURL 背景通知，验证 TradeSha 通过后才视为权威付款结果，见
 * .claude/specs/T3.1-T3.2-newebpay-spec.md 1.4 节（ReturnURL 仅用于前端导页显示，不可用来更新状态）。
 */
export async function confirmPurchasePayment(payload: { TradeInfo: string; TradeSha: string }) {
  const verified = verifyMpgNotification(payload);
  if (!verified.valid || !verified.result) {
    return { ok: false as const, reason: verified.message };
  }

  const { MerchantOrderNo, TradeNo } = verified.result;
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.newebpayMerchantOrderNo, MerchantOrderNo))
    .limit(1);

  if (!purchase) {
    return { ok: false as const, reason: `找不到对应购买记录：${MerchantOrderNo}` };
  }
  if (purchase.status !== "pending") {
    // 已处理过（藍新可能重送通知），视为成功、不重复更新
    return { ok: true as const, purchaseId: purchase.id };
  }

  const status = verified.status === "SUCCESS" ? "completed" : "failed";
  await db
    .update(purchases)
    .set({ status, newebpayTradeNo: TradeNo })
    .where(eq(purchases.id, purchase.id));

  return { ok: true as const, purchaseId: purchase.id };
}
