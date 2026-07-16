import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { bookings } from "@db/schema";

import { verifyMpgNotification } from "@/lib/payments/newebpay";

/**
 * 处理藍新 NotifyURL 背景通知，验证 TradeSha 通过后才视为权威付款结果（不可用 ReturnURL 更新状态，
 * 消费者可能中途关闭分頁），见 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.4 节。
 */
export async function confirmBookingPayment(payload: { TradeInfo: string; TradeSha: string }) {
  const verified = verifyMpgNotification(payload);
  if (!verified.valid || !verified.result) {
    return { ok: false as const, reason: verified.message };
  }
  if (verified.status !== "SUCCESS") {
    return { ok: false as const, reason: verified.message };
  }

  const { MerchantOrderNo, TradeNo } = verified.result;
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.newebpayMerchantOrderNo, MerchantOrderNo))
    .limit(1);

  if (!booking) {
    return { ok: false as const, reason: `找不到对应预约：${MerchantOrderNo}` };
  }
  if (booking.status !== "pending") {
    // 已处理过（藍新可能重送通知），视为成功、不重复更新
    return { ok: true as const, bookingId: booking.id };
  }

  await db
    .update(bookings)
    .set({ status: "confirmed", newebpayTradeNo: TradeNo })
    .where(eq(bookings.id, booking.id));

  return { ok: true as const, bookingId: booking.id };
}
