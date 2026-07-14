// mingyu（destiny.tathata.live）公開 API 型別定義
// 依 2026-07-14 實地擷取的 OpenAPI 規格（https://destiny.tathata.live/api/v1/openapi.json）整理，
// 回應內容欄位極深且會隨引擎版本增減，本檔只精準定義「請求」型別；回應一律視為 unknown，
// 原樣存進 chart_engine_results.result_data / divination_logs.result_data（jsonb），
// 不在應用層強行定義每個欄位，避免上游一改欄位就要跟著改本專案型別。

export type MingyuGender = "male" | "female";
export type MingyuDateType = "solar" | "lunar";

export interface BaziRequest {
  gender: MingyuGender;
  year: number;
  month: number;
  day: number;
  dateType: MingyuDateType;
  timeIndex?: number;
  isLeapMonth?: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: number;
  birthMinute?: number;
  birthPlace?: string;
  birthLongitude?: number;
}

export type ZiweiPromptScope =
  | "origin"
  | "decadal"
  | "yearly"
  | "monthly"
  | "daily"
  | "hourly"
  | "age";

export interface ZiweiRequest {
  gender: MingyuGender;
  dateType: MingyuDateType;
  year: string;
  month: string;
  day: string;
  name?: string;
  timeIndex?: number;
  promptScope?: ZiweiPromptScope;
  isLeapMonth?: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: string;
  birthMinute?: string;
  birthLongitude?: string;
}

/** 9 种占卜术数＋星盘共用同一个宽松的请求物件，各端点只吃自己相关的栏位 */
export interface DivinationRequest {
  question?: string;
  customDate?: string;
  qimenMethod?: "zhuanpan" | "feipan";
  method?: "time" | "number" | "random" | "external";
  number?: number;
  externalOmens?: {
    direction?: "东" | "东南" | "南" | "西南" | "西" | "西北" | "北" | "东北";
    count?: number;
    person?: "老父" | "老妇" | "长男" | "长女" | "中男" | "中女" | "少男" | "少女";
    animal?: "马" | "牛" | "龙" | "鸡" | "猪" | "雉" | "狗" | "羊";
    object?: "金玉圆器" | "布帛陶器" | "竹木乐器" | "绳索长木" | "水器液体" | "火电文书" | "石块门板" | "刀剪口器";
    sound?: "洪亮金石" | "沉厚低缓" | "雷鸣震动" | "风声呼啸" | "流水滴答" | "爆裂鸣叫" | "闷阻叩击" | "清脆笑语";
    color?: "金白" | "土黄" | "青碧" | "青绿" | "黑蓝" | "赤紫" | "棕黄" | "银白";
  };
  xiaoliurenMethod?: "time" | "number" | "random";
  xiaoliurenNumber?: number;
  spreadType?:
    | "single"
    | "three"
    | "love"
    | "career"
    | "decision"
    | "celtic"
    | "chakra"
    | "year"
    | "mindBodySpirit"
    | "horseshoe"
    | "relationship"
    | "nine";
  liuyaoTemplate?: "general" | "ganqing" | "shiye" | "caifu" | "guaishen";
  liurenTemplate?: "general" | "ganqing" | "shiye" | "caifu";
  topic?:
    | "marriage"
    | "move"
    | "opening"
    | "contract"
    | "travel"
    | "medical"
    | "study"
    | "burial"
    | "renovation"
    | "custom";
  startDate?: string;
  endDate?: string;
  gender?: "男" | "女" | "";
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  locationName?: string;
  useTrueSolarTime?: boolean;
  astrolabeTopic?: string;
  astrolabeScopeText?: string;
}

export interface MingyuSuccessEnvelope<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface MingyuErrorEnvelope {
  ok: false;
  error: { message: string; code?: string };
}

export type MingyuResponse<T = unknown> = MingyuSuccessEnvelope<T> | MingyuErrorEnvelope;

/** 对应 db/schema.ts 的 chart_engine_results.engine_type（bazi/ziwei/astrology 三种由 mingyu 提供） */
export type MingyuChartEngine = "bazi" | "ziwei" | "astrology";

/** 对应 db/schema.ts 的 divinationTypeEnum，与 mingyu 端点名不完全一致，见 client.ts 的映射表 */
export type MingyuDivinationType =
  | "liuyao"
  | "qimen"
  | "liuren"
  | "xiaoliuren"
  | "meihua"
  | "tarot"
  | "lenormand"
  | "lingqian"
  | "date_selection";
