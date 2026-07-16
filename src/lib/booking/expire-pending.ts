import { and, eq, lt } from "drizzle-orm";

import { db } from "@db/client";
import { bookings } from "@db/schema";

const PENDING_TIMEOUT_MINUTES = 15;

/**
 * 惰性释放逾时未完成付款的 pending 预约（比照电商订单逾时取消惯例）。
 * 查询/建立预约前皆应调用，理由见 .claude/specs/T6.1-booking-system-spec.md 五节：
 * pending 预约仍占用时段/名额，避免消费者付款页面停留期间时段被抢走，但需确实执行逾时释放。
 */
export async function expirePendingBookings(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000);
  await db
    .update(bookings)
    .set({ status: "canceled", cancelReason: "付款逾时未完成，系统自动释放时段", canceledAt: new Date() })
    .where(and(eq(bookings.status, "pending"), lt(bookings.createdAt, cutoff)));
}
