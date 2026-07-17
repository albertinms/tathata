import { NextResponse, type NextRequest } from "next/server";

import { confirmSubscriptionNotification } from "@/lib/subscriptions/confirm-subscription";

// 藍新每期授权完成通知 [NPA-N050]，Form Post 送达，权威来源，见
// .claude/specs/T3.1-T3.2-newebpay-spec.md 2.4 节。
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const period = formData.get("Period");

  if (typeof period !== "string") {
    return NextResponse.json({ error: "缺少 Period 栏位" }, { status: 400 });
  }

  const result = await confirmSubscriptionNotification({ Period: period });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
