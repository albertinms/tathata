import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@db/client";
import { plans, subscriptions, users } from "@db/schema";

import { createPeriodPaymentForm, getNewebPayCredentials, getSiteUrl } from "@/lib/payments/newebpay";
import type { NewebPayPeriodType } from "@/lib/payments/newebpay/types";

export class AlreadySubscribedError extends Error {}

// 无 T2.7 CAU 卡号更新服务，PeriodTimes 不能用 "NE" 无限期设定（那须搭配 CAU），
// 改用足够大的有限期数模拟「持续订阅直到使用者取消」，见 spec 2.2 节 PeriodTimes 说明
const EFFECTIVELY_UNLIMITED_PERIOD_TIMES = 999;

function buildMerOrderNo(): string {
  // 藍新要求英数与底线、≤30 字、同商店不可重复
  return `SB${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 12)}`.slice(0, 30);
}

function planIntervalToPeriod(billingInterval: string): {
  periodType: NewebPayPeriodType;
  periodPoint: string;
} {
  const now = new Date();
  if (billingInterval === "monthly") {
    // 每月同一天扣款；藍新 PeriodPoint 范围 01~31，31 号在小月会由藍新系统自动顺延处理
    return { periodType: "M", periodPoint: String(now.getDate()).padStart(2, "0") };
  }
  if (billingInterval === "yearly") {
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return { periodType: "Y", periodPoint: `${mm}${dd}` };
  }
  throw new Error(`方案 billingInterval=${billingInterval} 不支援定期定额（须为 monthly／yearly）`);
}

/**
 * 建立订阅委托，走藍新信用卡定期定额，见 .claude/specs/T3.1-T3.2-newebpay-spec.md 二节。
 * 与 MPG 一次性付款相同：无法用简单 302 导向，须回传 gatewayUrl／fields 给前端组 Form Post。
 */
export async function startSubscriptionCheckout(params: { userId: string; planCode: string }) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, params.planCode)).limit(1);
  if (!plan || !plan.isActive || !plan.priceAmount || !plan.priceCurrency) {
    throw new Error(`找不到有效的付费方案：${params.planCode}`);
  }

  const [existingActive] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, params.userId), eq(subscriptions.status, "active")))
    .limit(1);
  if (existingActive) {
    throw new AlreadySubscribedError("已有生效中的订阅，请先取消现有订阅再订购新方案");
  }

  const [user] = await db.select().from(users).where(eq(users.id, params.userId)).limit(1);
  if (!user) {
    throw new Error(`找不到使用者 ${params.userId}`);
  }

  // 先确认藍新凭证已设定（纯本机检查，无网路 I/O），排在写入 subscriptions 之前，
  // 避免凭证未设定时留下一笔卡在 pending 的订阅记录（同 T3.1／T6.1 的教训）
  getNewebPayCredentials();
  const siteUrl = getSiteUrl();
  const merOrderNo = buildMerOrderNo();
  const { periodType, periodPoint } = planIntervalToPeriod(plan.billingInterval);

  const { gatewayUrl, fields } = createPeriodPaymentForm({
    merOrderNo,
    prodDesc: plan.name,
    periodAmt: plan.priceAmount,
    periodType,
    periodPoint,
    // 立即执行委托金额授权（非十元验证），签约当下即开始收费
    periodStartType: 2,
    periodTimes: EFFECTIVELY_UNLIMITED_PERIOD_TIMES,
    payerEmail: user.email,
    notifyUrl: `${siteUrl}/api/payments/newebpay/subscription/confirm`,
    returnUrl: `${siteUrl}/api/payments/newebpay/subscription/return`,
  });

  await db.insert(subscriptions).values({
    userId: params.userId,
    planId: plan.id,
    status: "pending",
    newebpayMerOrderNo: merOrderNo,
  });

  return { gatewayUrl, fields };
}
