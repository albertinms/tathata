import { NextResponse, type NextRequest } from "next/server";

import { completeLinePayCheckout } from "@/lib/payments/checkout";

// 对应 startLinePayCheckout 传给 LINE Pay 的 redirectUrls.confirmUrl，
// LINE Pay 会带 transactionId／orderId query string 以浏览器 GET 转址回来
export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transactionId");
  if (!transactionId) {
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }

  try {
    const result = await completeLinePayCheckout({ transactionId });
    const destination = result.status === "completed" ? "/checkout/success" : "/checkout/failed";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }
}
