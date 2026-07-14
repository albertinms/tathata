import { createHmac } from "node:crypto";

/**
 * LINE Pay Online API v3 HMAC-SHA256 簽章演算法。
 * 查证依据：https://developers-pay.line.me/online/prerequisites（2026-07-14 查证）——
 * 待签字串＝channel secret + apiPath + body + nonce，UTF-8 编码，HMAC-SHA256 后 base64 输出。
 * GET 请求无 body，传入空字串 ""。
 */
export function signLinePayRequest(params: {
  channelSecret: string;
  apiPath: string;
  body: string;
  nonce: string;
}): string {
  const { channelSecret, apiPath, body, nonce } = params;
  const message = channelSecret + apiPath + body + nonce;
  return createHmac("sha256", channelSecret).update(message, "utf8").digest("base64");
}
