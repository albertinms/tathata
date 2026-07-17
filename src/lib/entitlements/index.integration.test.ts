import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@db/client";
import { planEntitlements, plans, purchases, subscriptions, users } from "@db/schema";

import { canAccessChapter, canAccessCourse, hasPurchased } from "./index";

/**
 * 打真实 Azure Postgres 的整合测试，需要 DATABASE_URL（本机 `set -a && . .env.local && set +a`）。
 * 不适合在没有资料库连线的 CI 环境直接跑，未来接 CI 前需要另外处理（例如独立的 test DB 或 skip 条件）。
 */
describe("entitlements engine (integration)", () => {
  let userId: string;
  let premiumPlanId: string;
  let freePlanId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `t3-entitlements-vitest-${Date.now()}@example.com` })
      .returning();
    userId = user.id;

    const [freePlan] = await db.select().from(plans).where(eq(plans.isDefault, true)).limit(1);
    if (!freePlan) throw new Error("默认免费方案不存在，请先套用 T3.4 migration");
    freePlanId = freePlan.id;

    const [premiumPlan] = await db
      .insert(plans)
      .values({
        code: `t3_test_premium_${Date.now()}`,
        name: "Test Premium",
        tierLevel: 10,
        billingInterval: "monthly",
        priceAmount: 299,
        priceCurrency: "TWD",
        isActive: true,
      })
      .returning();
    premiumPlanId = premiumPlan.id;
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(purchases).where(eq(purchases.userId, userId));
    await db
      .delete(planEntitlements)
      .where(inArray(planEntitlements.planId, [freePlanId, premiumPlanId]));
    await db.delete(plans).where(eq(plans.id, premiumPlanId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("denies chapter access when the free plan has no matching entitlement rule", async () => {
    expect(await canAccessChapter(userId, "preview_intro")).toBe(false);
  });

  it("grants chapter access via a LIKE pattern rule on the free plan", async () => {
    await db
      .insert(planEntitlements)
      .values({ planId: freePlanId, resourceType: "chapter", resourcePattern: "preview_%" });

    expect(await canAccessChapter(userId, "preview_intro")).toBe(true);
    expect(await canAccessChapter(userId, "flow_2026_08")).toBe(false);
  });

  it("prefers the active subscription's plan over the free plan", async () => {
    await db
      .insert(planEntitlements)
      .values({ planId: premiumPlanId, resourceType: "chapter", resourcePattern: "*" });
    await db.insert(subscriptions).values({
      userId,
      planId: premiumPlanId,
      status: "active",
      newebpayMerOrderNo: `test-sub-${Date.now()}`,
    });

    expect(await canAccessChapter(userId, "flow_2026_08")).toBe(true);
  });

  it("hasPurchased / canAccessCourse reflect a completed one-time purchase", async () => {
    await db.insert(purchases).values({
      userId,
      productType: "course",
      productRef: "course_101",
      amount: 1990,
      currency: "TWD",
      paymentProvider: "newebpay_mpg",
      newebpayMerchantOrderNo: `test-txn-${Date.now()}`,
      status: "completed",
    });

    expect(await hasPurchased(userId, "course", "course_101")).toBe(true);
    expect(await hasPurchased(userId, "course", "course_999")).toBe(false);
    expect(await canAccessCourse(userId, "course_101")).toBe(true);
    expect(await canAccessCourse(userId, "course_999")).toBe(false);
  });
});
