import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@db/client";
import { planEntitlements, plans, purchases, subscriptions } from "@db/schema";

export type EntitlementResourceType = "chapter" | "course";

export async function getUserActivePlan(
  userId: string,
): Promise<{ planId: string; tierLevel: number } | null> {
  const [activeSubscription] = await db
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .limit(1);

  if (activeSubscription?.planId) {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, activeSubscription.planId), eq(plans.isActive, true)))
      .limit(1);
    if (plan) {
      return { planId: plan.id, tierLevel: plan.tierLevel };
    }
  }

  // 没有有效订阅（或方案已下架）→ fallback 到免费方案，见 T3.4 spec 3 节
  const [defaultPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.isDefault, true), eq(plans.isActive, true)))
    .limit(1);
  return defaultPlan ? { planId: defaultPlan.id, tierLevel: defaultPlan.tierLevel } : null;
}

export async function hasPlanAccess(
  userId: string,
  resourceType: EntitlementResourceType,
  resourceCode: string,
): Promise<boolean> {
  const activePlan = await getUserActivePlan(userId);
  if (!activePlan) {
    return false;
  }

  const [match] = await db
    .select({ id: planEntitlements.id })
    .from(planEntitlements)
    .where(
      and(
        eq(planEntitlements.planId, activePlan.planId),
        eq(planEntitlements.resourceType, resourceType),
        or(
          eq(planEntitlements.resourcePattern, "*"),
          sql`${resourceCode} LIKE ${planEntitlements.resourcePattern}`,
        ),
      ),
    )
    .limit(1);

  return Boolean(match);
}

export async function hasPurchased(
  userId: string,
  productType: "book_package" | "course",
  productRef: string,
): Promise<boolean> {
  const [purchase] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.productType, productType),
        eq(purchases.productRef, productRef),
        eq(purchases.status, "completed"),
      ),
    )
    .limit(1);
  return Boolean(purchase);
}

/**
 * ⚠️ 已知限制：book_package 购买目前只在 productRef 粒度记录（例如「完整命书套餐」这一整包），
 * 尚无「套餐 → 涵盖哪些 chapter_code」的目录表（该目录由 T4.1 建立，见 T3.4 spec 1 节「这次不做」），
 * 故此处**尚未**把 book_package 购买接进章节解锁，只走方案（plan_entitlements）判断。
 * T4.1 建好章节目录后，需要在这里补上购买层的判断，做法与 canAccessCourse 类似。
 */
export async function canAccessChapter(userId: string, chapterCode: string): Promise<boolean> {
  return hasPlanAccess(userId, "chapter", chapterCode);
}

// 购买优先于方案：买断过的课程不受订阅到期/降级影响，理由见 T3.4 spec 3 节
export async function canAccessCourse(userId: string, courseRef: string): Promise<boolean> {
  if (await hasPurchased(userId, "course", courseRef)) {
    return true;
  }
  return hasPlanAccess(userId, "course", courseRef);
}
