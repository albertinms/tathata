import { NextResponse, type NextRequest } from "next/server";

import { completeLinePaySubscriptionCheckout } from "@/lib/payments/subscription-checkout";

// 对应 startLinePaySubscriptionCheckout 传给 LINE Pay 的 redirectUrls.confirmUrl
export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transactionId");
  if (!transactionId) {
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }

  try {
    const result = await completeLinePaySubscriptionCheckout({ transactionId });
    const destination = result.status === "active" ? "/checkout/success" : "/checkout/failed";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL("/checkout/failed", request.url));
  }
}
