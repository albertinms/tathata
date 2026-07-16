import { computeTradeSha, decryptTradeInfo, encryptTradeInfo } from "./crypto";
import { getNewebPayCredentials, getNewebPayMpgGatewayUrl } from "./client";
import type { NewebPayMpgTradeInfoInput, NewebPayVerifiedNotification } from "./types";

/**
 * 建立 MPG 一次性付款请求，查证依据 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.2／1.3 节。
 * 回传值供前端组成 HTML Form Post 到 gatewayUrl（藍新要求浏览器端 Form Post，非 fetch/XHR）。
 */
export function createMpgPaymentForm(input: NewebPayMpgTradeInfoInput): {
  gatewayUrl: string;
  fields: { MerchantID: string; TradeInfo: string; TradeSha: string; Version: string };
} {
  const { merchantId, hashKey, hashIv } = getNewebPayCredentials();

  const params: Record<string, string> = {
    MerchantID: merchantId,
    RespondType: "JSON",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: "2.3",
    MerchantOrderNo: input.merchantOrderNo,
    Amt: String(input.amt),
    ItemDesc: input.itemDesc,
  };
  if (input.email) params.Email = input.email;
  if (input.returnUrl) params.ReturnURL = input.returnUrl;
  if (input.notifyUrl) params.NotifyURL = input.notifyUrl;
  if (input.clientBackUrl) params.ClientBackURL = input.clientBackUrl;
  if (input.tradeLimit) params.TradeLimit = String(input.tradeLimit);

  const queryString = new URLSearchParams(params).toString();
  const tradeInfo = encryptTradeInfo({ queryString, hashKey, hashIv });
  const tradeSha = computeTradeSha({ tradeInfoHex: tradeInfo, hashKey, hashIv });

  return {
    gatewayUrl: getNewebPayMpgGatewayUrl(),
    fields: { MerchantID: merchantId, TradeInfo: tradeInfo, TradeSha: tradeSha, Version: "2.3" },
  };
}

/**
 * 验证并解密 NotifyURL／ReturnURL 收到的通知。
 * 务必重新计算 TradeSha 并比对，比对失败视为无效通知，不可更新订单状态（spec 1.2 节步骤 4）。
 */
export function verifyMpgNotification(payload: {
  TradeInfo: string;
  TradeSha: string;
}): NewebPayVerifiedNotification {
  const { hashKey, hashIv } = getNewebPayCredentials();

  const expectedSha = computeTradeSha({ tradeInfoHex: payload.TradeInfo, hashKey, hashIv });
  if (expectedSha !== payload.TradeSha) {
    return { valid: false, status: "INVALID_SHA", message: "TradeSha 比对失败，通知可能被竄改" };
  }

  const decrypted = decryptTradeInfo({ tradeInfoHex: payload.TradeInfo, hashKey, hashIv });
  const parsed = JSON.parse(decrypted) as {
    Status: string;
    Message: string;
    Result?: NewebPayVerifiedNotification["result"];
  };

  return { valid: true, status: parsed.Status, message: parsed.Message, result: parsed.Result };
}
