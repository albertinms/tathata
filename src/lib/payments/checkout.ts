import { randomUUID } from "node:crypto";

import { db } from "@db/client";
import { purchases } from "@db/schema";

import { findCatalogProduct } from "./catalog";
import { createMpgPaymentForm, getSiteUrl } from "./newebpay";

function buildMerchantOrderNo(): string {
  // 藍新要求英数与底线、≤30 字、同商店不可重复
  return `PB${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 12)}`.slice(0, 30);
}

/**
 * 建立一次性购买（命书套餐／课程），走藍新 MPG，见 .claude/specs/T3.1-T3.2-newebpay-spec.md 一节。
 * 与 LINE Pay 时期不同：MPG 无法用简单 302 导向完成付款，须回传 gatewayUrl／fields
 * 给前端组成 HTML Form Post（见 checkout 页面）。
 */
export async function startCheckout(params: {
  userId: string;
  productType: "book_package" | "course";
  productRef: string;
}) {
  const product = findCatalogProduct(params.productType, params.productRef);
  if (!product) {
    throw new Error(`找不到商品：${params.productType}/${params.productRef}`);
  }

  const merchantOrderNo = buildMerchantOrderNo();
  const siteUrl = getSiteUrl();

  // 先组表单（纯本机加密运算，无网路 I/O）：NEWEBPAY_* 凭证尚未设定时会在此直接 throw，
  // 刻意排在 insert 之前，避免留下一笔永远卡在 pending、无对应付款请求的 purchase
  const { gatewayUrl, fields } = createMpgPaymentForm({
    merchantOrderNo,
    amt: product.amount,
    itemDesc: product.name,
    notifyUrl: `${siteUrl}/api/payments/newebpay/purchase/confirm`,
    returnUrl: `${siteUrl}/api/payments/newebpay/purchase/return`,
    clientBackUrl: `${siteUrl}/checkout/cancel`,
  });

  await db.insert(purchases).values({
    userId: params.userId,
    productType: product.productType,
    productRef: product.productRef,
    amount: product.amount,
    currency: product.currency,
    paymentProvider: "newebpay_mpg",
    newebpayMerchantOrderNo: merchantOrderNo,
    status: "pending",
  });

  return { gatewayUrl, fields };
}
