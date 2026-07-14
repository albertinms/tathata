import type { MingyuResponse } from "./types";

// 现阶段跨公网呼叫既有部署（见 .claude/specs/T2.1a-T2.2-盘点发现.md 的决策记录）；
// 之后若接 VNet 内部网路，只需要改这个环境变数指向内部位址，呼叫端程式码不用动
const MINGYU_API_BASE_URL = process.env.MINGYU_API_BASE_URL ?? "https://destiny.tathata.live/api/v1";

export class MingyuApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "MingyuApiError";
  }
}

export async function mingyuPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${MINGYU_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as MingyuResponse<T>;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? `HTTP ${response.status}` : payload.error.message;
    const code = payload.ok ? undefined : payload.error.code;
    throw new MingyuApiError(message, response.status, code);
  }

  return payload.data;
}
