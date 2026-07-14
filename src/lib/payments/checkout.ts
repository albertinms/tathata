import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { purchases } from "@db/schema";

import { findCatalogProduct } from "./catalog";
import { confirmLinePayPayment, requestLinePayPayment } from "./linepay";
import type { LinePayCurrency } from "./linepay/types";

function getSiteUrl() {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new Error("SITE_URL 尚未设定");
  }
  return url;
}

export async function startLinePayCheckout(params: {
  userId: string;
  productType: "book_package" | "course";
  productRef: string;
}) {
  const product = findCatalogProduct(params.productType, params.productRef);
  if (!product) {
    throw new Error(`找不到商品：${params.productType}/${params.productRef}`);
  }

  const orderId = randomUUID();
  const siteUrl = getSiteUrl();

  const [purchase] = await db
    .insert(purchases)
    .values({
      userId: params.userId,
      productType: product.productType,
      productRef: product.productRef,
      amount: product.amount,
      currency: product.currency,
      paymentProvider: "linepay",
      // 先暂存 orderId 满足 unique 约束，LINE Pay 回传 transactionId 后立刻改写成真正的值
      paymentTransactionId: orderId,
      status: "pending",
    })
    .returning();

  // 用 try/catch 而非只检查 returnCode：requestLinePayPayment 本身也可能直接 throw
  // （例如 LINEPAY_CHANNEL_ID／SECRET 尚未设定），两种失败都要让 purchase 落回 failed，不留在 pending
  let result;
  try {
    result = await requestLinePayPayment({
      amount: product.amount,
      currency: product.currency,
      orderId,
      packages: [
        {
          id: "default",
          amount: product.amount,
          products: [
            { id: product.productRef, name: product.name, quantity: 1, price: product.amount },
          ],
        },
      ],
      redirectUrls: {
        confirmUrl: `${siteUrl}/api/payments/linepay/confirm`,
        cancelUrl: `${siteUrl}/checkout/cancel`,
      },
    });
  } catch (error) {
    await db.update(purchases).set({ status: "failed" }).where(eq(purchases.id, purchase.id));
    throw error;
  }

  if (result.returnCode !== "0000") {
    await db.update(purchases).set({ status: "failed" }).where(eq(purchases.id, purchase.id));
    throw new Error(`LINE Pay 建立付款失败：${result.returnCode} ${result.returnMessage}`);
  }

  await db
    .update(purchases)
    .set({ paymentTransactionId: String(result.info.transactionId) })
    .where(eq(purchases.id, purchase.id));

  return { paymentUrl: result.info.paymentUrl.web, purchaseId: purchase.id };
}

export async function completeLinePayCheckout(params: { transactionId: string }) {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.paymentTransactionId, params.transactionId))
    .limit(1);

  if (!purchase) {
    throw new Error(`找不到对应的 purchase：transactionId=${params.transactionId}`);
  }

  const result = await confirmLinePayPayment({
    transactionId: params.transactionId,
    amount: purchase.amount,
    currency: purchase.currency as LinePayCurrency,
  });

  const status = result.returnCode === "0000" ? "completed" : "failed";
  await db.update(purchases).set({ status }).where(eq(purchases.id, purchase.id));

  return { status, purchaseId: purchase.id };
}
