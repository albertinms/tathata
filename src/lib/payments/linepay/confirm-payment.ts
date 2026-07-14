import { linePayRequest } from "./client";
import type { LinePayConfirmPaymentInfo, LinePayCurrency } from "./types";

// 查证依据：https://developers-pay.line.me/online-api-v3/confirm-payment（2026-07-14 查证）
export async function confirmLinePayPayment(params: {
  transactionId: number | string;
  amount: number;
  currency: LinePayCurrency;
}) {
  return linePayRequest<LinePayConfirmPaymentInfo>({
    method: "POST",
    apiPath: `/v3/payments/${params.transactionId}/confirm`,
    body: { amount: params.amount, currency: params.currency },
  });
}
