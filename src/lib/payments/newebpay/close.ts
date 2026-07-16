import { encryptTradeInfo } from "./crypto";
import { getNewebPayCloseApiUrl, getNewebPayCredentials } from "./client";
import type { NewebPayCloseRefundInput, NewebPayCloseRefundResponse } from "./types";

/**
 * 请退款／取消请退款 [NPA-B031~34]，查证依据 .claude/specs/T6.1-booking-system-spec.md 六节。
 * 送出方式：MerchantID_（明文）＋PostData_（AES256 加密，演算法同 MPG 的 AES 步骤，无独立 TradeSha 栏位）。
 */
export async function refundNewebPayTrade(
  input: NewebPayCloseRefundInput,
): Promise<NewebPayCloseRefundResponse> {
  const { merchantId, hashKey, hashIv } = getNewebPayCredentials();

  const params: Record<string, string> = {
    RespondType: "JSON",
    Version: "1.1",
    Amt: String(input.amt),
    MerchantOrderNo: input.merchantOrderNo,
    TradeNo: input.tradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    IndexType: String(input.indexType ?? 2),
    CloseType: String(input.closeType ?? 2),
  };

  const queryString = new URLSearchParams(params).toString();
  const postData = encryptTradeInfo({ queryString, hashKey, hashIv });

  const body = new URLSearchParams({ MerchantID_: merchantId, PostData_: postData });
  const response = await fetch(getNewebPayCloseApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return (await response.json()) as NewebPayCloseRefundResponse;
}
