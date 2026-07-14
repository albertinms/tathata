import { mingyuPost } from "./client";
import type { BaziRequest, DivinationRequest, MingyuDivinationType, ZiweiRequest } from "./types";

export { MingyuApiError } from "./client";
export * from "./types";

export async function calculateBazi(request: BaziRequest) {
  return mingyuPost("/bazi/calculate", request);
}

export async function calculateZiwei(request: ZiweiRequest) {
  return mingyuPost("/ziwei/calculate", request);
}

export async function calculateAstrolabe(request: DivinationRequest) {
  return mingyuPost("/divination/astrolabe", request);
}

// db/schema.ts 的 divinationTypeEnum 与 mingyu 端点命名不完全一致
// （lingqian→ssgw 三山国王灵签、date_selection→almanac 黄历择日），其余七种一对一对应
const DIVINATION_ENDPOINT: Record<MingyuDivinationType, string> = {
  liuyao: "/divination/liuyao",
  qimen: "/divination/qimen",
  liuren: "/divination/liuren",
  xiaoliuren: "/divination/xiaoliuren",
  meihua: "/divination/meihua",
  tarot: "/divination/tarot",
  lenormand: "/divination/lenormand",
  lingqian: "/divination/ssgw",
  date_selection: "/divination/almanac",
};

export async function calculateDivination(type: MingyuDivinationType, request: DivinationRequest) {
  return mingyuPost(DIVINATION_ENDPOINT[type], request);
}
