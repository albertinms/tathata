import { randomUUID } from "node:crypto";

import { signLinePayRequest } from "./signature";
import type { LinePayApiResponse } from "./types";

const LINEPAY_BASE_URL = {
  sandbox: "https://sandbox-api-pay.line.me",
  production: "https://api-pay.line.me",
} as const;

// 刻意不在 module 顶层读取 env var：T1.2 排错时发现 Docker build 阶段会静态分析路由模组，
// 顶层就需要环境变数的写法会在还没设定 LINEPAY_* 之前就让 build 失败（见 STATE.md T1.2 经验）
function getLinePayEnv() {
  const channelId = process.env.LINEPAY_CHANNEL_ID;
  const channelSecret = process.env.LINEPAY_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new Error(
      "LINEPAY_CHANNEL_ID／LINEPAY_CHANNEL_SECRET 尚未设定（T0.2 sandbox 凭证待补），无法呼叫 LINE Pay API",
    );
  }
  const env = process.env.LINEPAY_ENV === "production" ? "production" : "sandbox";
  return { channelId, channelSecret, baseUrl: LINEPAY_BASE_URL[env] };
}

export async function linePayRequest<TInfo>(params: {
  method: "GET" | "POST";
  apiPath: string;
  body?: unknown;
}): Promise<LinePayApiResponse<TInfo>> {
  const { channelId, channelSecret, baseUrl } = getLinePayEnv();
  const nonce = randomUUID();
  const bodyString = params.method === "POST" ? JSON.stringify(params.body ?? {}) : "";

  const signature = signLinePayRequest({
    channelSecret,
    apiPath: params.apiPath,
    body: bodyString,
    nonce,
  });

  const response = await fetch(`${baseUrl}${params.apiPath}`, {
    method: params.method,
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": signature,
    },
    body: params.method === "POST" ? bodyString : undefined,
  });

  return (await response.json()) as LinePayApiResponse<TInfo>;
}
