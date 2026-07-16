import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@db/client";
import { bookings, workshopSessions } from "@db/schema";

import { expirePendingBookings } from "./expire-pending";
import { getBookingServiceById } from "./services";

export class BookingSlotTakenError extends Error {}
export class BookingCapacityFullError extends Error {}

function buildMerchantOrderNo(): string {
  // 藍新要求英数与底线、≤30 字、同商店不可重复
  return `BK${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 12)}`.slice(0, 30);
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // postgres.js 驱动的原始错误码在 drizzle-orm 的 DrizzleQueryError.cause 上，非顶层
  const err = error as { code?: string; cause?: { code?: string } };
  return err.code === "23505" || err.cause?.code === "23505";
}

/**
 * one_to_one 建立预约。防重复预约靠资料库 partial unique index（bookings_one_to_one_slot_unique）
 * 做最后把关，不用「先 SELECT 确认空闲、再 INSERT」两步式判断（race condition 空隙），
 * 见 .claude/specs/T6.1-booking-system-spec.md 四节。
 */
export async function createOneToOneBooking(params: {
  serviceId: string;
  userId: string;
  startAt: Date;
  customerNote?: string;
}) {
  await expirePendingBookings();

  const service = await getBookingServiceById(params.serviceId);
  if (!service || service.type !== "one_to_one" || !service.durationMinutes) {
    throw new Error(`服务 ${params.serviceId} 不是有效的 one_to_one 服务`);
  }
  if (params.startAt <= new Date()) {
    throw new Error("预约时段须为未来时间");
  }

  const endAt = new Date(params.startAt.getTime() + service.durationMinutes * 60 * 1000);
  const merchantOrderNo = buildMerchantOrderNo();

  try {
    const [booking] = await db
      .insert(bookings)
      .values({
        serviceId: params.serviceId,
        userId: params.userId,
        startAt: params.startAt,
        endAt,
        status: "pending",
        newebpayMerchantOrderNo: merchantOrderNo,
        customerNote: params.customerNote,
      })
      .returning();
    return { booking, service };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BookingSlotTakenError("该时段已被预约，请重新选择");
    }
    throw error;
  }
}

/**
 * workshop 建立预约。COUNT 聚合函式无法直接搭配 FOR UPDATE（PostgreSQL 语法限制），
 * 改为鎖定 workshop_sessions 该笔列（FOR UPDATE），序列化并发交易的名额计算，
 * 交易内完成计数与写入才提交，避免并发超卖，见 spec 四节。
 */
export async function createWorkshopBooking(params: {
  sessionId: string;
  userId: string;
  customerNote?: string;
}) {
  await expirePendingBookings();

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(workshopSessions)
      .where(eq(workshopSessions.id, params.sessionId))
      .for("update");
    if (!session || session.status !== "open") {
      throw new Error(`场次 ${params.sessionId} 不存在或未开放报名`);
    }
    if (session.sessionStartAt <= new Date()) {
      throw new Error("该场次已开始，无法报名");
    }

    const service = await getBookingServiceById(session.serviceId);
    if (!service) {
      throw new Error(`找不到对应的服务 ${session.serviceId}`);
    }
    const capacity = session.capacity ?? service.capacity;

    const existing = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(eq(bookings.sessionId, params.sessionId), inArray(bookings.status, ["pending", "confirmed"])),
      );
    if (existing.length >= capacity) {
      throw new BookingCapacityFullError("名额已满");
    }

    const merchantOrderNo = buildMerchantOrderNo();
    const [booking] = await tx
      .insert(bookings)
      .values({
        serviceId: session.serviceId,
        sessionId: session.id,
        userId: params.userId,
        startAt: session.sessionStartAt,
        endAt: session.sessionEndAt,
        status: "pending",
        newebpayMerchantOrderNo: merchantOrderNo,
        customerNote: params.customerNote,
      })
      .returning();

    return { booking, service };
  });
}
