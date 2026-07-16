import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@db/client";
import {
  availabilityExceptions,
  availabilityRules,
  bookings,
  workshopSessions,
} from "@db/schema";

import { expirePendingBookings } from "./expire-pending";
import { getBookingServiceById } from "./services";

export type TimeSlot = { startAt: Date; endAt: Date };

// 单一时区 Asia/Taipei（无日光节约时间），比照 PROFILE.md「台湾为主」，见 spec 一节。
// 一律以显式 +08:00 offset 组字串再交给 Date 解析，避免依赖执行环境（Azure 容器通常是 UTC）的本地时区设定。
const TAIPEI_OFFSET = "+08:00";

function nextDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dateStringDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function combineTaipeiDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}${TAIPEI_OFFSET}`);
}

/**
 * one_to_one 可用时段计算，查证依据 .claude/specs/T6.1-booking-system-spec.md 三节。
 * 不预先产生未来时段列，查询当下即时计算：规则展开 → 减例外 → 减既有预约。
 */
export async function getOneToOneAvailability(params: {
  serviceId: string;
  fromDate: string; // YYYY-MM-DD，Taipei 当地日期
  toDate: string; // YYYY-MM-DD，含首尾
}): Promise<TimeSlot[]> {
  await expirePendingBookings();

  const service = await getBookingServiceById(params.serviceId);
  if (!service || service.type !== "one_to_one" || !service.durationMinutes) {
    throw new Error(`服务 ${params.serviceId} 不是有效的 one_to_one 服务`);
  }
  const durationMs = service.durationMinutes * 60 * 1000;

  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.serviceId, params.serviceId));

  const exceptions = await db
    .select()
    .from(availabilityExceptions)
    .where(
      and(
        eq(availabilityExceptions.serviceId, params.serviceId),
        gte(availabilityExceptions.date, params.fromDate),
        lte(availabilityExceptions.date, params.toDate),
      ),
    );

  const rangeStart = combineTaipeiDateTime(params.fromDate, "00:00:00");
  const rangeEnd = combineTaipeiDateTime(nextDateString(params.toDate), "00:00:00");
  const existingBookings = await db
    .select({ startAt: bookings.startAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.serviceId, params.serviceId),
        inArray(bookings.status, ["pending", "confirmed"]),
        gte(bookings.startAt, rangeStart),
        lte(bookings.startAt, rangeEnd),
      ),
    );
  const bookedStartTimes = new Set(existingBookings.map((b) => b.startAt.getTime()));

  const now = new Date();
  const slots: TimeSlot[] = [];

  const expandRange = (dateStr: string, startTime: string, endTime: string) => {
    let cursor = combineTaipeiDateTime(dateStr, startTime);
    const end = combineTaipeiDateTime(dateStr, endTime);
    while (cursor.getTime() + durationMs <= end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMs);
      if (slotStart > now && !bookedStartTimes.has(slotStart.getTime())) {
        slots.push({ startAt: slotStart, endAt: slotEnd });
      }
      cursor = slotEnd;
    }
  };

  for (let dateStr = params.fromDate; dateStr <= params.toDate; dateStr = nextDateString(dateStr)) {
    const exceptionForDay = exceptions.find((e) => e.date === dateStr);
    if (exceptionForDay?.isAvailable === false) {
      continue; // 当天请假，整天不开放
    }

    const dayOfWeek = dateStringDayOfWeek(dateStr);
    const applicableRules = rules.filter(
      (r) =>
        r.dayOfWeek === dayOfWeek &&
        r.effectiveFrom <= dateStr &&
        (!r.effectiveUntil || r.effectiveUntil >= dateStr),
    );
    for (const rule of applicableRules) {
      expandRange(dateStr, rule.startTime, rule.endTime);
    }

    if (exceptionForDay?.isAvailable === true && exceptionForDay.startTime && exceptionForDay.endTime) {
      expandRange(dateStr, exceptionForDay.startTime, exceptionForDay.endTime);
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export type WorkshopSessionAvailability = {
  id: string;
  sessionStartAt: Date;
  sessionEndAt: Date;
  locationOrLink: string | null;
  capacity: number;
  remaining: number;
};

/** workshop 场次清单＋剩余名额，查证依据 spec 三节。 */
export async function getWorkshopAvailability(
  serviceId: string,
): Promise<WorkshopSessionAvailability[]> {
  await expirePendingBookings();

  const service = await getBookingServiceById(serviceId);
  if (!service || service.type !== "workshop") {
    throw new Error(`服务 ${serviceId} 不是有效的 workshop 服务`);
  }

  const sessions = await db
    .select()
    .from(workshopSessions)
    .where(and(eq(workshopSessions.serviceId, serviceId), eq(workshopSessions.status, "open")));

  const results: WorkshopSessionAvailability[] = [];
  for (const session of sessions) {
    if (session.sessionStartAt <= new Date()) continue;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(eq(bookings.sessionId, session.id), inArray(bookings.status, ["pending", "confirmed"])),
      );

    const capacity = session.capacity ?? service.capacity;
    results.push({
      id: session.id,
      sessionStartAt: session.sessionStartAt,
      sessionEndAt: session.sessionEndAt,
      locationOrLink: session.locationOrLink,
      capacity,
      remaining: Math.max(0, capacity - count),
    });
  }

  return results.sort((a, b) => a.sessionStartAt.getTime() - b.sessionStartAt.getTime());
}
