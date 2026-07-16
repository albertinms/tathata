import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { bookings } from "@db/schema";

import { getBookingServiceById } from "./services";
import { refundNewebPayTrade } from "@/lib/payments/newebpay";

export class BookingNotFoundError extends Error {}
export class BookingNotCancelableError extends Error {}

/**
 * 使用者主动取消预约。退款政策见 .claude/specs/T6.1-booking-system-spec.md 6.2 节：
 * cancel_deadline_hours 之前取消 → 全额退款；期限内取消 → 依 late_cancel_refund_pct（预设 0）比例退款。
 */
export async function cancelBooking(params: {
  bookingId: string;
  userId: string;
  reason?: string;
}) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, params.bookingId)).limit(1);
  if (!booking || booking.userId !== params.userId) {
    throw new BookingNotFoundError(`找不到预约 ${params.bookingId}`);
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new BookingNotCancelableError(`预约状态为 ${booking.status}，无法取消`);
  }

  const service = await getBookingServiceById(booking.serviceId);
  if (!service) {
    throw new Error(`找不到对应的服务 ${booking.serviceId}`);
  }

  // pending 状态代表从未完成付款，无需退款
  if (booking.status === "confirmed" && booking.newebpayTradeNo) {
    const deadline = new Date(
      booking.startAt.getTime() - service.cancelDeadlineHours * 60 * 60 * 1000,
    );
    const isBeforeDeadline = new Date() <= deadline;
    const refundPct = isBeforeDeadline ? 100 : service.lateCancelRefundPct;

    if (refundPct > 0) {
      const refundAmt = Math.round((service.priceAmount * refundPct) / 100);
      const refundResult = await refundNewebPayTrade({
        amt: refundAmt,
        merchantOrderNo: booking.newebpayMerchantOrderNo,
        tradeNo: booking.newebpayTradeNo,
        closeType: 2,
        indexType: 2,
      });
      if (refundResult.Status !== "SUCCESS") {
        throw new Error(`藍新退款失败：${refundResult.Status} ${refundResult.Message}`);
      }
    }
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "canceled", cancelReason: params.reason, canceledAt: new Date() })
    .where(eq(bookings.id, params.bookingId))
    .returning();

  return updated;
}

/**
 * 商店端取消整个工作坊场次：对该场次所有 confirmed 预约批次退款，不受 cancel_deadline_hours 限制
 * （商店单方面取消，非顾客违约），见 spec 6.3 节。通知机制留给 T6.2／T6.3 视前端需求决定。
 */
export async function cancelWorkshopSessionBookings(params: { sessionId: string }) {
  const affectedBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.sessionId, params.sessionId));

  for (const booking of affectedBookings) {
    if (booking.status !== "confirmed") continue;
    if (booking.newebpayTradeNo) {
      const service = await getBookingServiceById(booking.serviceId);
      await refundNewebPayTrade({
        amt: service?.priceAmount ?? 0,
        merchantOrderNo: booking.newebpayMerchantOrderNo,
        tradeNo: booking.newebpayTradeNo,
        closeType: 2,
        indexType: 2,
      });
    }
    await db
      .update(bookings)
      .set({ status: "canceled", cancelReason: "场次由商店端取消，已全额退款", canceledAt: new Date() })
      .where(eq(bookings.id, booking.id));
  }
}
