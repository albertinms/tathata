import { decryptTradeInfo, encryptTradeInfo } from "./crypto";
import {
  getNewebPayCredentials,
  getNewebPayPeriodAlterStatusUrl,
  getNewebPayPeriodCreateUrl,
} from "./client";
import type {
  NewebPayAlterPeriodStatusInput,
  NewebPayAlterPeriodStatusResponse,
  NewebPayCreatePeriodInput,
  NewebPayPeriodCreateResult,
  NewebPayPeriodNotifyResult,
  NewebPayVerifiedPeriodNotification,
} from "./types";

// ⚠️ 官方 PDF 对建立委托回应／NPA-N050 通知的加密栏位命名，本轮查证只确认了「Period（AES 加密）」
// 这个描述性说法，未逐字确认栏位 key 是否真的叫 "Period"（不同于 MPG 的 "TradeInfo"）。
// 待 T0.2' sandbox 凭证到位、首次实测建立委托时务必核对实际回应/通知栏位名称，
// 若不符需同步修正本档与 NotifyURL route 的 formData.get() 取值 key（比照 preapproved.ts 先例）。
const PERIOD_ENCRYPTED_FIELD = "Period";

/**
 * 建立委托 [NPA-B05]，浏览器 Form Post gateway（需使用者在藍新页面输入卡号），
 * 送出方式：MerchantID_（明文）＋PostData_（AES256 加密，无独立 TradeSha 栏位），
 * 见 .claude/specs/T3.1-T3.2-newebpay-spec.md 2.1／2.2 节。
 */
export function createPeriodPaymentForm(input: NewebPayCreatePeriodInput): {
  gatewayUrl: string;
  fields: { MerchantID_: string; PostData_: string };
} {
  const { merchantId, hashKey, hashIv } = getNewebPayCredentials();

  const params: Record<string, string> = {
    RespondType: "JSON",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: "1.5",
    MerOrderNo: input.merOrderNo,
    ProdDesc: input.prodDesc,
    PeriodAmt: String(input.periodAmt),
    PeriodType: input.periodType,
    PeriodPoint: input.periodPoint,
    PeriodStartType: String(input.periodStartType),
    PeriodTimes: String(input.periodTimes),
    PayerEmail: input.payerEmail,
  };
  if (input.returnUrl) params.ReturnURL = input.returnUrl;
  if (input.notifyUrl) params.NotifyURL = input.notifyUrl;
  if (input.periodMemo) params.PeriodMemo = input.periodMemo;

  const queryString = new URLSearchParams(params).toString();
  const postData = encryptTradeInfo({ queryString, hashKey, hashIv });

  return {
    gatewayUrl: getNewebPayPeriodCreateUrl(),
    fields: { MerchantID_: merchantId, PostData_: postData },
  };
}

function decryptPeriodPayload<T>(encryptedHex: string): T {
  const { hashKey, hashIv } = getNewebPayCredentials();
  const decrypted = decryptTradeInfo({ tradeInfoHex: encryptedHex, hashKey, hashIv });
  return JSON.parse(decrypted) as T;
}

/**
 * 解析建立委托的 ReturnURL／NotifyURL 回应。无 TradeSha 可比对（spec 2.1 节：定期定额封装
 * 无独立检查码栏位），能成功 AES 解密＋JSON.parse 即视为来自持有 HashKey／HashIV 的一方。
 */
export function parsePeriodCreateResult(payload: Record<string, string>): {
  ok: boolean;
  result?: { Status: string; Message: string; Result: NewebPayPeriodCreateResult };
} {
  const encrypted = payload[PERIOD_ENCRYPTED_FIELD];
  if (!encrypted) return { ok: false };
  try {
    const parsed = decryptPeriodPayload<{
      Status: string;
      Message: string;
      Result: NewebPayPeriodCreateResult;
    }>(encrypted);
    return { ok: true, result: parsed };
  } catch {
    return { ok: false };
  }
}

/** 每期授权完成通知 [NPA-N050]，见 spec 2.4 节。 */
export function verifyPeriodNotification(payload: {
  [PERIOD_ENCRYPTED_FIELD]?: string;
}): NewebPayVerifiedPeriodNotification {
  const encrypted = payload[PERIOD_ENCRYPTED_FIELD];
  if (!encrypted) {
    return { valid: false, status: "MISSING_PAYLOAD" };
  }
  try {
    const parsed = decryptPeriodPayload<{ Status: string; Result: NewebPayPeriodNotifyResult }>(
      encrypted,
    );
    return { valid: true, status: parsed.Status, result: parsed.Result };
  } catch {
    return { valid: false, status: "DECRYPT_FAILED" };
  }
}

/**
 * 修改委托状态 [NPA-B051]：suspend／terminate／restart。终止后无法再次启用（不可逆），
 * 见 spec 2.5 节。伺服器对伺服器 API，无需使用者操作。
 */
export async function alterPeriodStatus(
  input: NewebPayAlterPeriodStatusInput,
): Promise<NewebPayAlterPeriodStatusResponse> {
  const { merchantId, hashKey, hashIv } = getNewebPayCredentials();

  const params: Record<string, string> = {
    RespondType: "JSON",
    Version: "1.0",
    MerOrderNo: input.merOrderNo,
    PeriodNo: input.periodNo,
    AlterType: input.alterType,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };

  const queryString = new URLSearchParams(params).toString();
  const postData = encryptTradeInfo({ queryString, hashKey, hashIv });

  const body = new URLSearchParams({ MerchantID_: merchantId, PostData_: postData });
  const response = await fetch(getNewebPayPeriodAlterStatusUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return (await response.json()) as NewebPayAlterPeriodStatusResponse;
}
