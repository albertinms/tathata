import { NextResponse, type NextRequest } from "next/server";

import { confirmBookingPayment } from "@/lib/booking/confirm-payment";

// 藍新 NotifyURL 背景通知，Form Post 送达（application/x-www-form-urlencoded），
// 权威付款结果来源（不可用 ReturnURL），见 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.4 节。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tradeInfo = formData.get("TradeInfo");
  const tradeSha = formData.get("TradeSha");

  if (typeof tradeInfo !== "string" || typeof tradeSha !== "string") {
    return NextResponse.json({ error: "缺少 TradeInfo／TradeSha" }, { status: 400 });
  }

  const result = await confirmBookingPayment({ TradeInfo: tradeInfo, TradeSha: tradeSha });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
