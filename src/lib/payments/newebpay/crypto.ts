import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

/**
 * 藍新金流加解密演算法，查证依据 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.2 节
 * （官方 PDF 原档逐栏位查证，非训练资料臆测）。
 * TradeInfo：query string 以 AES-256-CBC＋PKCS7Padding 加密，HashKey 当 key、HashIV 当 iv，结果转十六进位字串。
 */
export function encryptTradeInfo(params: {
  queryString: string;
  hashKey: string;
  hashIv: string;
}): string {
  const cipher = createCipheriv("aes-256-cbc", params.hashKey, params.hashIv);
  const encrypted = Buffer.concat([
    cipher.update(params.queryString, "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("hex");
}

export function decryptTradeInfo(params: {
  tradeInfoHex: string;
  hashKey: string;
  hashIv: string;
}): string {
  const decipher = createDecipheriv("aes-256-cbc", params.hashKey, params.hashIv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(params.tradeInfoHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** TradeSha：HashKey=<HashKey>&<TradeInfo>&HashIV=<HashIV> 串接后 SHA256，转大写。 */
export function computeTradeSha(params: {
  tradeInfoHex: string;
  hashKey: string;
  hashIv: string;
}): string {
  const message = `HashKey=${params.hashKey}&${params.tradeInfoHex}&HashIV=${params.hashIv}`;
  return createHash("sha256").update(message, "utf8").digest("hex").toUpperCase();
}

/**
 * CheckCode：查询/退款等 API 回应验证用（非 MPG 付款完成通知），
 * 取回应中 Amt／MerchantID／MerchantOrderNo／TradeNo 依英文字母排序串接，
 * 前缀 HashIV=，后缀 HashKey=，SHA256 转大写。
 */
export function computeCheckCode(params: {
  amt: number | string;
  merchantId: string;
  merchantOrderNo: string;
  tradeNo: string;
  hashKey: string;
  hashIv: string;
}): string {
  const message =
    `HashIV=${params.hashIv}` +
    `&Amt=${params.amt}` +
    `&MerchantID=${params.merchantId}` +
    `&MerchantOrderNo=${params.merchantOrderNo}` +
    `&TradeNo=${params.tradeNo}` +
    `&HashKey=${params.hashKey}`;
  return createHash("sha256").update(message, "utf8").digest("hex").toUpperCase();
}

/**
 * CheckValue：发动查询请求时的签章用（非回应验证），
 * 取请求中 Amt／MerchantID／MerchantOrderNo 依英文字母排序串接，前缀 IV=，后缀 Key=，SHA256 转大写。
 */
export function computeCheckValue(params: {
  amt: number | string;
  merchantId: string;
  merchantOrderNo: string;
  hashKey: string;
  hashIv: string;
}): string {
  const message =
    `IV=${params.hashIv}` +
    `&Amt=${params.amt}` +
    `&MerchantID=${params.merchantId}` +
    `&MerchantOrderNo=${params.merchantOrderNo}` +
    `&Key=${params.hashKey}`;
  return createHash("sha256").update(message, "utf8").digest("hex").toUpperCase();
}
