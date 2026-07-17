import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@db/client";
import { plans, subscriptions, users } from "@db/schema";

import { encryptTradeInfo } from "@/lib/payments/newebpay/crypto";

import { confirmSubscriptionNotification } from "./confirm-subscription";

/**
 * 打真实 Azure Postgres 的整合测试，理由同 src/lib/entitlements/index.integration.test.ts。
 * 藍新凭证（NEWEBPAY_MERCHANT_ID／HASH_KEY／HASH_IV）尚未由 T0.2' 取得真实值，
 * 本测试用假凭证自行加密模拟 NPA-N050 通知内容，只验证本专案的解密＋状态机逻辑，
 * **不验证藍新官方栏位命名是否与实际回应一致**（见 period.ts 顶部注解，待真实凭证到位再核对）。
 */
describe("subscription confirm (integration)", () => {
  const hashKey = "12345678901234567890123456789012"; // 32 碼假凭证，仅供测试加解密对称使用
  const hashIv = "1234567890123456"; // 16 碼

  let userId: string;
  let planId: string;
  let subscriptionId: string;
  const merOrderNo = `test-sub-${Date.now()}`;

  beforeAll(async () => {
    process.env.NEWEBPAY_MERCHANT_ID = "TEST_MERCHANT";
    process.env.NEWEBPAY_HASH_KEY = hashKey;
    process.env.NEWEBPAY_HASH_IV = hashIv;

    const [user] = await db
      .insert(users)
      .values({ email: `t3-2-sub-vitest-${Date.now()}@example.com` })
      .returning();
    userId = user.id;

    const [plan] = await db
      .insert(plans)
      .values({
        code: `t3_2_test_plan_${Date.now()}`,
        name: "Test Monthly",
        tierLevel: 5,
        billingInterval: "monthly",
        priceAmount: 199,
        priceCurrency: "TWD",
        isActive: true,
      })
      .returning();
    planId = plan.id;

    const [subscription] = await db
      .insert(subscriptions)
      .values({ userId, planId, status: "pending", newebpayMerOrderNo: merOrderNo })
      .returning();
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
    await db.delete(plans).where(eq(plans.id, planId));
    await db.delete(users).where(eq(users.id, userId));
  });

  function buildNotification(overrides: { status: string; alreadyTimes: number }) {
    const payload = {
      Status: overrides.status,
      Result: {
        RespondCode: overrides.status === "SUCCESS" ? "1" : "9",
        MerchantID: "TEST_MERCHANT",
        MerchantOrderNo: merOrderNo,
        OrderNo: `${merOrderNo}_${overrides.alreadyTimes}`,
        TradeNo: `TRADE${overrides.alreadyTimes}`,
        AuthDate: "2026/08/15",
        TotalTimes: 999,
        AlreadyTimes: overrides.alreadyTimes,
        AuthAmt: 199,
        AuthCode: "123456",
        NextAuthDate: "2026/09/15",
        PeriodNo: "PN1234567890",
      },
    };
    const queryString = JSON.stringify(payload);
    const period = encryptTradeInfo({ queryString, hashKey, hashIv });
    return { Period: period };
  }

  it("activates the subscription on the first successful period notification", async () => {
    const result = await confirmSubscriptionNotification(
      buildNotification({ status: "SUCCESS", alreadyTimes: 1 }),
    );
    expect(result.ok).toBe(true);

    const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    expect(updated.status).toBe("active");
    expect(updated.newebpayPeriodNo).toBe("PN1234567890");
    expect(updated.retryCount).toBe(0);
  });

  it("marks the subscription past_due on a failed period notification without terminating", async () => {
    const result = await confirmSubscriptionNotification(
      buildNotification({ status: "PER10001", alreadyTimes: 2 }),
    );
    expect(result.ok).toBe(true);

    const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId));
    expect(updated.status).toBe("past_due");
    expect(updated.retryCount).toBe(1);
  });
});
