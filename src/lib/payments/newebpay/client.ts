const NEWEBPAY_MPG_BASE_URL = {
  sandbox: "https://ccore.newebpay.com",
  production: "https://core.newebpay.com",
} as const;

const NEWEBPAY_CLOSE_BASE_URL = {
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
  return `${NEWEBPAY_MPG_BASE_URL[getNewebPayEnvName()]}/MPG/mpg_gateway`;
}

export function getNewebPayCloseApiUrl() {
  return `${NEWEBPAY_CLOSE_BASE_URL[getNewebPayEnvName()]}/API/CreditCard/Close`;
}

function getSiteUrl() {
  const url = process.env.SITE_URL;
  if (!url) {
    throw new Error("SITE_URL 尚未设定");
  }
  return url;
}

export { getSiteUrl };
