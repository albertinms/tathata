import { NextResponse, type NextRequest } from "next/server";

import { verifyMpgNotification } from "@/lib/payments/newebpay";

// 藍新 ReturnURL：消费者付款完成后浏览器 Form Post 导回商店页面，仅用于前端导页显示，
// 不可用来更新订单状态（消费者可能中途关闭分頁），权威来源是 purchase/confirm 的 NotifyURL，
// 见 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.4 节。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tradeInfo = formData.get("TradeInfo");
  const tradeSha = formData.get("TradeSha");

  // 303 强制浏览器改用 GET 重新请求目的页，藍新是用 POST Form 导回，307（redirect 预设）会保留 POST
  // 方法导致 /checkout/success 这类 GET-only 页面 405
  if (typeof tradeInfo !== "string" || typeof tradeSha !== "string") {
    return NextResponse.redirect(new URL("/checkout/failed", request.url), 303);
  }

  const verified = verifyMpgNotification({ TradeInfo: tradeInfo, TradeSha: tradeSha });
  const destination = verified.valid && verified.status === "SUCCESS" ? "/checkout/success" : "/checkout/failed";
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
