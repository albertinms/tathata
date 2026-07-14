import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { plans, subscriptions } from "@db/schema";

import { confirmLinePayPayment, requestLinePayPayment } from "./linepay";
import type { LinePayCurrency } from "./linepay/types";

function getSiteUrl() {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new Error("SITE_URL 尚未设定");
  }
  return url;
}

function addBillingInterval(from: Date, interval: "monthly" | "yearly"): Date {
  const next = new Date(from);
  if (interval === "monthly") {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  return next;
}

export async function startLinePaySubscriptionCheckout(params: {
  userId: string;
  planCode: string;
}) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, params.planCode)).limit(1);
  if (!plan || !plan.isActive) {
    throw new Error(`方案不存在或未启用：${params.planCode}`);
  }
  if (plan.billingInterval !== "monthly" && plan.billingInterval !== "yearly") {
    throw new Error(`方案 ${params.planCode} 非订阅类型（billing_interval=${plan.billingInterval}）`);
  }
  if (!plan.priceAmount || !plan.priceCurrency) {
    throw new Error(`方案 ${params.planCode} 尚未设定价格`);
  }

  const orderId = randomUUID();
  const siteUrl = getSiteUrl();

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      userId: params.userId,
      planId: plan.id,
      status: "pending",
    })
    .returning();

  // 用 try/catch 而非只检查 returnCode：requestLinePayPayment 本身也可能直接 throw
  // （例如 LINEPAY_CHANNEL_ID／SECRET 尚未设定），两种失败都要让 subscription 落回 canceled
  let result;
  try {
    result = await requestLinePayPayment({
      amount: plan.priceAmount,
      currency: plan.priceCurrency as LinePayCurrency,
      orderId,
      packages: [
        {
          id: "default",
          amount: plan.priceAmount,
          products: [{ id: plan.code, name: plan.name, quantity: 1, price: plan.priceAmount }],
        },
      ],
      redirectUrls: {
        confirmUrl: `${siteUrl}/api/payments/linepay/subscribe-confirm`,
        cancelUrl: `${siteUrl}/checkout/cancel`,
      },
      options: { payment: { payType: "PREAPPROVED" } },
    });
  } catch (error) {
    await db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, subscription.id));
    throw error;
  }

  if (result.returnCode !== "0000") {
    await db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, subscription.id));
    throw new Error(`LINE Pay 建立订阅失败：${result.returnCode} ${result.returnMessage}`);
  }

  await db
    .update(subscriptions)
    .set({ linepayTransactionId: String(result.info.transactionId) })
    .where(eq(subscriptions.id, subscription.id));

  return { paymentUrl: result.info.paymentUrl.web, subscriptionId: subscription.id };
}

export async function completeLinePaySubscriptionCheckout(params: { transactionId: string }) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.linepayTransactionId, params.transactionId))
    .limit(1);

  if (!subscription || !subscription.planId) {
    throw new Error(`找不到对应的订阅：linepayTransactionId=${params.transactionId}`);
  }

  const [plan] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
  if (!plan || !plan.priceAmount || !plan.priceCurrency) {
    throw new Error(`订阅 ${subscription.id} 对应的方案已失效或未设定价格`);
  }

  const result = await confirmLinePayPayment({
    transactionId: params.transactionId,
    amount: plan.priceAmount,
    currency: plan.priceCurrency as LinePayCurrency,
  });

  if (result.returnCode !== "0000" || !result.info.regKey) {
    await db
      .update(subscriptions)
      .set({ status: "canceled" })
      .where(eq(subscriptions.id, subscription.id));
    return { status: "canceled" as const, subscriptionId: subscription.id };
  }

  const now = new Date();
  await db
    .update(subscriptions)
    .set({
      status: "active",
      linepayRegKey: result.info.regKey,
      lastPaymentAt: now,
      nextBillingDate: addBillingInterval(now, plan.billingInterval as "monthly" | "yearly")
        .toISOString()
        .slice(0, 10),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscription.id));

  return { status: "active" as const, subscriptionId: subscription.id };
}
