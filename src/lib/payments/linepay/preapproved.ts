import { linePayRequest } from "./client";
import type { LinePayCurrency, LinePayPreapprovedChargeInfo } from "./types";

/**
 * ⚠️ 2026-07-14 查证时发现官方文件对 preapproved 系列 endpoint 的版本不一致：
 * `/online-api-v3/request-preapproved-payment` 页面显示 `/v3/payments/preapprovedPay/{regKey}/payment`，
 * 但 `/online/implement-preapproved-payment` 指南显示 charge/check/expire 都在 `/v4/...`。
 * 尚未取得 sandbox 凭证无法实测校正，此处暂采 v3（与 request/confirm 版本一致），
 * **待 T0.2 sandbox 凭证到位、T3.2 首次实测时务必重新确认**，若错误只需改这一个常数。
 */
const PREAPPROVED_PATH_PREFIX = "/v3/payments/preapprovedPay";

export async function chargeLinePayPreapproved(params: {
  regKey: string;
  orderId: string;
  productName: string;
  amount: number;
  currency: LinePayCurrency;
}) {
  return linePayRequest<LinePayPreapprovedChargeInfo>({
    method: "POST",
    apiPath: `${PREAPPROVED_PATH_PREFIX}/${params.regKey}/payment`,
    body: {
      orderId: params.orderId,
      productName: params.productName,
      amount: params.amount,
      currency: params.currency,
    },
  });
}

export async function expireLinePayPreapproved(params: { regKey: string }) {
  return linePayRequest<Record<string, never>>({
    method: "POST",
    apiPath: `${PREAPPROVED_PATH_PREFIX}/${params.regKey}/expire`,
    body: {},
  });
}
