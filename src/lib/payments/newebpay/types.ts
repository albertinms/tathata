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

// 信用卡定期定额（订阅），见 .claude/specs/T3.1-T3.2-newebpay-spec.md 二节

export type NewebPayPeriodType = "D" | "W" | "M" | "Y";

/** 建立委托 [NPA-B05] */
export type NewebPayCreatePeriodInput = {
  merOrderNo: string;
  prodDesc: string;
  periodAmt: number;
  periodType: NewebPayPeriodType;
  /** 依 periodType 决定格式：D→2~999；W→1~7；M→01~31；Y→MMDD */
  periodPoint: string;
  /** 1=立即十元验证／2=立即执行委托金额授权／3=不检查信用卡资讯、不授权 */
  periodStartType: 1 | 2 | 3;
  periodTimes: number;
  payerEmail: string;
  returnUrl?: string;
  notifyUrl?: string;
  periodMemo?: string;
};

/** 建立委托回应（Period 栏位，AES 加密，解密后内容） */
export type NewebPayPeriodCreateResult = {
  MerchantID: string;
  MerchantOrderNo: string;
  PeriodType: string;
  AuthTimes: number;
  DateArray: string;
  PeriodAmt: number;
  PeriodNo: string;
  AuthTime?: string;
  TradeNo?: string;
  CardNo?: string;
  AuthCode?: string;
  RespondCode?: string;
  [key: string]: unknown;
};

/** 每期授权完成通知 [NPA-N050]（推播至 NotifyURL），解密后内容 */
export type NewebPayPeriodNotifyResult = {
  RespondCode: string;
  MerchantID: string;
  MerchantOrderNo: string;
  /** 格式＝商店订单编号_期数 */
  OrderNo: string;
  TradeNo: string;
  AuthDate: string;
  TotalTimes: number;
  AlreadyTimes: number;
  AuthAmt: number;
  AuthCode: string;
  /** 下次授权日；若本期为最后一期则回传本期日期 */
  NextAuthDate: string;
  PeriodNo: string;
  [key: string]: unknown;
};

export type NewebPayVerifiedPeriodNotification = {
  valid: boolean;
  status: string;
  result?: NewebPayPeriodNotifyResult;
};

/** 修改委托状态 [NPA-B051] */
export type NewebPayAlterPeriodStatusInput = {
  merOrderNo: string;
  periodNo: string;
  alterType: "suspend" | "terminate" | "restart";
};

export type NewebPayAlterPeriodStatusResponse = {
  Status: string;
  Message: string;
  Result?: {
    MerOrderNo: string;
    PeriodNo: string;
    AlterType: string;
    NewNextTime?: string;
    [key: string]: unknown;
  };
};
