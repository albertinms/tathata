import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@db/client";
import { plans, subscriptions, users } from "@db/schema";

import {
  findPastDueSubscriptionsForRetry,
  findSubscriptionsDueForBilling,
} from "./subscription-billing";

/**
 * 只测试查询层（哪些订阅该被扣款/重试），不测 chargeLinePayPreapproved 之后的分支——
 * 那部分需要真实 LINE Pay sandbox 凭证才能有意义地验证，T0.2 凭证到位后再补。
 *
 * 每笔订阅各用独立的测试帐号：subscriptions_active_user_unique（T1.3 已定案的 partial unique index）
 * 限制同一使用者同时只能有一笔 active 订阅，同一使用者塞两笔 active 会直接撞 DB 约束。
 */
describe("subscription billing queries (integration)", () => {
  let userIds: string[] = [];
  let planId: string;
  let activeDueSubId: string;
  let activeNotDueSubId: string;
  let pastDueSubId: string;

  beforeAll(async () => {
    const [plan] = await db
      .insert(plans)
      .values({
        code: `t3_test_billing_plan_${Date.now()}`,
        name: "Test Billing Plan",
        tierLevel: 5,
        billingInterval: "monthly",
        priceAmount: 199,
        priceCurrency: "TWD",
        isActive: true,
      })
      .returning();
    planId = plan.id;

    const insertedUsers = await db
      .insert(users)
      .values([
        { email: `t3-billing-vitest-due-${Date.now()}@example.com` },
        { email: `t3-billing-vitest-notdue-${Date.now()}@example.com` },
        { email: `t3-billing-vitest-pastdue-${Date.now()}@example.com` },
      ])
      .returning();
    userIds = insertedUsers.map((u) => u.id);
    const [dueUserId, notDueUserId, pastDueUserId] = userIds;

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const nextMonth = new Date();
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const [dueSub] = await db
      .insert(subscriptions)
      .values({
        userId: dueUserId,
        planId,
        status: "active",
        nextBillingDate: yesterday.toISOString().slice(0, 10),
      })
      .returning();
    activeDueSubId = dueSub.id;

    const [notDueSub] = await db
      .insert(subscriptions)
      .values({
        userId: notDueUserId,
        planId,
        status: "active",
        nextBillingDate: nextMonth.toISOString().slice(0, 10),
      })
      .returning();
    activeNotDueSubId = notDueSub.id;

    const [pastDueSub] = await db
      .insert(subscriptions)
      .values({
        userId: pastDueUserId,
        planId,
        status: "past_due",
        retryCount: 1,
        nextBillingDate: yesterday.toISOString().slice(0, 10),
      })
      .returning();
    pastDueSubId = pastDueSub.id;
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(inArray(subscriptions.userId, userIds));
    await db.delete(plans).where(eq(plans.id, planId));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  it("finds active subscriptions whose next_billing_date has passed, and excludes not-yet-due ones", async () => {
    const due = await findSubscriptionsDueForBilling(new Date());
    const ids = due.map((s) => s.id);
    expect(ids).toContain(activeDueSubId);
    expect(ids).not.toContain(activeNotDueSubId);
    expect(ids).not.toContain(pastDueSubId);
  });

  it("finds past_due subscriptions ready for retry", async () => {
    const retryable = await findPastDueSubscriptionsForRetry(new Date());
    const ids = retryable.map((s) => s.id);
    expect(ids).toContain(pastDueSubId);
    expect(ids).not.toContain(activeDueSubId);
  });
});
