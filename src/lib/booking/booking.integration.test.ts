import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@db/client";
import { availabilityRules, bookingServices, bookings, users, workshopSessions } from "@db/schema";

import { getOneToOneAvailability } from "./availability";
import { BookingCapacityFullError, BookingSlotTakenError, createOneToOneBooking, createWorkshopBooking } from "./create-booking";

/**
 * 打真实 Azure Postgres 的整合测试，理由同 src/lib/entitlements/index.integration.test.ts
 * （需要 DATABASE_URL，本机 `set -a && . .env.local && set +a` 后执行）。
 */
describe("booking system (integration)", () => {
  let userId: string;
  let oneToOneServiceId: string;
  let workshopServiceId: string;
  let workshopSessionId: string;

  // 固定选未来第 30 天，避开「今天」在时段引擎里的 now 截止判断边界
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const futureDateStr = futureDate.toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${futureDateStr}T00:00:00Z`).getUTCDay();

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `t6-booking-vitest-${Date.now()}@example.com` })
      .returning();
    userId = user.id;

    const [oneToOneService] = await db
      .insert(bookingServices)
      .values({
        type: "one_to_one",
        name: "Test 塔罗谈询",
        durationMinutes: 30,
        capacity: 1,
        priceAmount: 1000,
      })
      .returning();
    oneToOneServiceId = oneToOneService.id;

    await db.insert(availabilityRules).values({
      serviceId: oneToOneServiceId,
      dayOfWeek,
      startTime: "14:00:00",
      endTime: "15:00:00",
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });

    const [workshopService] = await db
      .insert(bookingServices)
      .values({ type: "workshop", name: "Test 工作坊", capacity: 1, priceAmount: 2000 })
      .returning();
    workshopServiceId = workshopService.id;

    const sessionStart = new Date(futureDate.getTime());
    sessionStart.setUTCHours(6, 0, 0, 0); // 14:00 台北时间
    const [session] = await db
      .insert(workshopSessions)
      .values({
        serviceId: workshopServiceId,
        sessionStartAt: sessionStart,
        sessionEndAt: new Date(sessionStart.getTime() + 60 * 60 * 1000),
        status: "open",
      })
      .returning();
    workshopSessionId = session.id;
  });

  afterAll(async () => {
    await db.delete(bookings).where(eq(bookings.userId, userId));
    await db.delete(workshopSessions).where(eq(workshopSessions.id, workshopSessionId));
    await db
      .delete(availabilityRules)
      .where(eq(availabilityRules.serviceId, oneToOneServiceId));
    await db
      .delete(bookingServices)
      .where(inArray(bookingServices.id, [oneToOneServiceId, workshopServiceId]));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("expands availability_rules into concrete time slots within the queried range", async () => {
    const slots = await getOneToOneAvailability({
      serviceId: oneToOneServiceId,
      fromDate: futureDateStr,
      toDate: futureDateStr,
    });
    expect(slots.length).toBe(2); // 14:00-14:30, 14:30-15:00
    expect(slots[0].startAt.getTime()).toBeLessThan(slots[1].startAt.getTime());
  });

  it("rejects a second one_to_one booking on the same slot via the unique index", async () => {
    const slots = await getOneToOneAvailability({
      serviceId: oneToOneServiceId,
      fromDate: futureDateStr,
      toDate: futureDateStr,
    });
    const targetSlot = slots[0].startAt;

    await createOneToOneBooking({ serviceId: oneToOneServiceId, userId, startAt: targetSlot });

    await expect(
      createOneToOneBooking({ serviceId: oneToOneServiceId, userId, startAt: targetSlot }),
    ).rejects.toThrow(BookingSlotTakenError);
  });

  it("enforces workshop capacity via the row-locked transaction", async () => {
    await createWorkshopBooking({ sessionId: workshopSessionId, userId });

    await expect(createWorkshopBooking({ sessionId: workshopSessionId, userId })).rejects.toThrow(
      BookingCapacityFullError,
    );
  });
});
