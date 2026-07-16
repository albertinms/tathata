import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "@db/client";
import { bookings } from "@db/schema";

/** 预约时间已过、仍为 confirmed 者惰性转 completed（人工核销/取消不受影响，见 spec 五节）。 */
async function completePastConfirmedBookings(userId: string) {
  await db
    .update(bookings)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "confirmed"), lt(bookings.endAt, new Date())));
}

export async function listMyBookings(userId: string) {
  await completePastConfirmedBookings(userId);
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.startAt));
}
