const NEWEBPAY_BASE_URL = {
  sandbox: "https://ccore.newebpay.com",
  production: "https://core.newebpay.com",
} as const;

// 刻意不在 module 顶层读取 env var：Docker build 阶段 next build 会静态分析路由模组，
// 顶层读 env 会在还没设定 NEWEBPAY_* 前让 build 失败（见 STATE.md T1.2 经验）
function getNewebPayEnvName() {
  return process.env.NEWEBPAY_ENV === "production" ? "production" : "sandbox";
}

export function getNewebPayCredentials() {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID;
  const hashKey = process.env.NEWEBPAY_HASH_KEY;
  const hashIv = process.env.NEWEBPAY_HASH_IV;
  if (!merchantId || !hashKey || !hashIv) {
    throw new Error(
      "NEWEBPAY_MERCHANT_ID／NEWEBPAY_HASH_KEY／NEWEBPAY_HASH_IV 尚未设定（T0.2' 商家申请待补），无法呼叫藍新金流 API",
    );
  }
  return { merchantId, hashKey, hashIv };
}

export function getNewebPayMpgGatewayUrl() {
  return `${NEWEBPAY_BASE_URL[getNewebPayEnvName()]}/MPG/mpg_gateway`;
}

export function getNewebPayCloseApiUrl() {
  return `${NEWEBPAY_BASE_URL[getNewebPayEnvName()]}/API/CreditCard/Close`;
}

/** 建立委托 [NPA-B05]，浏览器 Form Post gateway（同 MPG，需使用者在藍新页面输入卡号） */
export function getNewebPayPeriodCreateUrl() {
  return `${NEWEBPAY_BASE_URL[getNewebPayEnvName()]}/MPG/period`;
}

/** 修改委托状态 [NPA-B051]，伺服器对伺服器 API（suspend/terminate/restart） */
export function getNewebPayPeriodAlterStatusUrl() {
  return `${NEWEBPAY_BASE_URL[getNewebPayEnvName()]}/MPG/period/AlterStatus`;
}

/** 修改委托内容 [NPA-B052]，伺服器对伺服器 API（改金额/周期/期数等） */
export function getNewebPayPeriodAlterAmtUrl() {
  return `${NEWEBPAY_BASE_URL[getNewebPayEnvName()]}/MPG/period/AlterAmt`;
}

function getSiteUrl() {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new Error("SITE_URL 尚未设定");
  }
  return url;
}

export { getSiteUrl };
