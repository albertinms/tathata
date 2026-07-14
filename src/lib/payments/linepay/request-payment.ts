import { linePayRequest } from "./client";
import type { LinePayRequestPaymentInfo, LinePayRequestPaymentInput } from "./types";

// 查证依据：https://developers-pay.line.me/online-api-v3/request-payment（2026-07-14 查证）
export async function requestLinePayPayment(input: LinePayRequestPaymentInput) {
  return linePayRequest<LinePayRequestPaymentInfo>({
    method: "POST",
    apiPath: "/v3/payments/request",
    body: input,
  });
}
