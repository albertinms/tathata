import { and, eq, lte } from "drizzle-orm";

import { db } from "@db/client";
import { plans, subscriptions } from "@db/schema";

import { chargeLinePayPreapproved } from "../payments/linepay";
import type { LinePayCurrency } from "../payments/linepay/types";

// 重试策略：连续失败达此次数后放弃并转为 canceled（subscriptionStatusEnum 没有独立的
// dunning 失败终态，past_due 达到上限后直接转 canceled，对应实际状态机简化，理由见 T3.3 备注）
const MAX_RETRY_COUNT = 3;
const RETRY_INTERVAL_DAYS = 1;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type DueSubscription = Awaited<ReturnType<typeof findSubscriptionsDueForBilling>>[number];

export async function findSubscriptionsDueForBilling(asOf: Date) {
  return db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      planId: subscriptions.planId,
      status: subscriptions.status,
      linepayRegKey: subscriptions.linepayRegKey,
      retryCount: subscriptions.retryCount,
      nextBillingDate: subscriptions.nextBillingDate,
      planCode: plans.code,
      planName: plans.name,
      priceAmount: plans.priceAmount,
      priceCurrency: plans.priceCurrency,
      billingInterval: plans.billingInterval,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.nextBillingDate, toDateOnly(asOf)),
      ),
    );
}

export async function findPastDueSubscriptionsForRetry(asOf: Date) {
  return db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      planId: subscriptions.planId,
      status: subscriptions.status,
      linepayRegKey: subscriptions.linepayRegKey,
      retryCount: subscriptions.retryCount,
      nextBillingDate: subscriptions.nextBillingDate,
      planCode: plans.code,
      planName: plans.name,
      priceAmount: plans.priceAmount,
      priceCurrency: plans.priceCurrency,
      billingInterval: plans.billingInterval,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.status, "past_due"),
        lte(subscriptions.nextBillingDate, toDateOnly(asOf)),
      ),
    );
}

export async function processSubscriptionBilling(
  subscription: DueSubscription,
  now: Date = new Date(),
): Promise<{ subscriptionId: string; outcome: "active" | "past_due" | "canceled" }> {
  if (!subscription.linepayRegKey || !subscription.priceAmount || !subscription.priceCurrency) {
    // 资料不完整（例如 T3.2 尚未成功产生 regKey）视同失败，走同一套重试/放弃逻辑
    return applyBillingFailure(subscription, now);
  }

  const result = await chargeLinePayPreapproved({
    regKey: subscription.linepayRegKey,
    orderId: `sub-${subscription.id}-${now.getTime()}`,
    productName: subscription.planName,
    amount: subscription.priceAmount,
    currency: subscription.priceCurrency as LinePayCurrency,
  });

  if (result.returnCode !== "0000") {
    return applyBillingFailure(subscription, now);
  }

  const nextBillingDate = addBillingInterval(
    now,
    subscription.billingInterval as "monthly" | "yearly",
  );
  await db
    .update(subscriptions)
    .set({
      status: "active",
      retryCount: 0,
      lastPaymentAt: now,
      nextBillingDate: toDateOnly(nextBillingDate),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscription.id));

  return { subscriptionId: subscription.id, outcome: "active" };
}

async function applyBillingFailure(subscription: DueSubscription, now: Date) {
  const nextRetryCount = subscription.retryCount + 1;

  if (nextRetryCount >= MAX_RETRY_COUNT) {
    await db
      .update(subscriptions)
      .set({ status: "canceled", retryCount: nextRetryCount, canceledAt: now, updatedAt: now })
      .where(eq(subscriptions.id, subscription.id));
    return { subscriptionId: subscription.id, outcome: "canceled" as const };
  }

  await db
    .update(subscriptions)
    .set({
      status: "past_due",
      retryCount: nextRetryCount,
      nextBillingDate: toDateOnly(addDays(now, RETRY_INTERVAL_DAYS)),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscription.id));
  return { subscriptionId: subscription.id, outcome: "past_due" as const };
}

export async function runSubscriptionBillingCycle(now: Date = new Date()) {
  const due = [...(await findSubscriptionsDueForBilling(now)), ...(await findPastDueSubscriptionsForRetry(now))];

  const results = [];
  for (const subscription of due) {
    // 刻意逐笔循序处理（非 Promise.all 并行）：避免同时对大量使用者触发 LINE Pay 请求造成瞬间流量尖峰，
    // 也让单笔失败不影响其他笔的执行顺序与除错可读性；量体成长后可视情况改批次/佇列
    results.push(await processSubscriptionBilling(subscription, now));
  }
  return results;
}
