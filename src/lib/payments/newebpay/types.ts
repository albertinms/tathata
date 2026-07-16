// 藍新金流 MPG（幕前支付）与退款 API 型别，查证依据 .claude/specs/T3.1-T3.2-newebpay-spec.md

export type NewebPayMpgTradeInfoInput = {
  merchantOrderNo: string;
  amt: number;
  itemDesc: string;
  email?: string;
  returnUrl?: string;
  notifyUrl?: string;
  clientBackUrl?: string;
  tradeLimit?: number;
};

/** NotifyURL／ReturnURL 解密 TradeInfo 后的付款结果内容 */
export type NewebPayMpgNotifyResult = {
  Status: string;
  Message: string;
  Result: {
    MerchantID: string;
    Amt: number;
    TradeNo: string;
    MerchantOrderNo: string;
    PaymentType?: string;
    RespondType?: string;
    PayTime?: string;
    IP?: string;
    EscrowBank?: string;
    AuthBank?: string;
    [key: string]: unknown;
  };
};

export type NewebPayVerifiedNotification = {
  valid: boolean;
  status: string;
  message: string;
  result?: NewebPayMpgNotifyResult["Result"];
};

/** 请退款／取消请退款 [NPA-B031~34]，见 .claude/specs/T6.1-booking-system-spec.md 六节 */
export type NewebPayCloseRefundInput = {
  amt: number;
  merchantOrderNo: string;
  tradeNo: string;
  /** 2=退款（本专案唯一使用情境）；1=请款，本专案 MPG 即时支付通常已自动请款不需要 */
  closeType?: 1 | 2;
  /** 1=用 MerchantOrderNo／2=用 TradeNo，本专案统一用 2 */
  indexType?: 1 | 2;
};

export type NewebPayCloseRefundResponse = {
  Status: string;
  Message: string;
  Result?: {
    MerchantID: string;
    Amt: number;
    TradeNo: string;
    MerchantOrderNo: string;
    [key: string]: unknown;
  };
};
