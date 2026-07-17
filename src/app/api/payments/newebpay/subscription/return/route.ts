import { NextResponse, type NextRequest } from "next/server";

import { parsePeriodCreateResult } from "@/lib/payments/newebpay";

// 藍新 ReturnURL：首次授权完成后浏览器 Form Post 导回商店页面，仅用于前端导页显示，
// 不可用来更新订阅状态（权威来源是 subscription/confirm 的 NotifyURL），见 spec 2.2 节。
// 303 强制浏览器改用 GET 重新请求目的页（同一次性付款 return route 的教训，见 T3.1）。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = parsePeriodCreateResult(Object.fromEntries(formData.entries()) as Record<string, string>);

  const destination =
    parsed.ok && parsed.result?.Status === "SUCCESS" ? "/subscribe/success" : "/subscribe/failed";
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
