import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---- enums ----

export const birthTimePrecisionEnum = pgEnum("birth_time_precision", [
  "exact",
  "estimated",
  "unknown",
]);
export const calendarTypeEnum = pgEnum("calendar_type", ["solar", "lunar"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const engineTypeEnum = pgEnum("engine_type", [
  "bazi",
  "ziwei",
  "astrology",
  "human_design",
  "numerology",
]);
export const productTypeEnum = pgEnum("product_type", ["book_package", "course"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["linepay"]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);
// "pending"：T3.2 新增，regKey 申请已送出、等待使用者在 LINE app 内完成授权确认，尚未变成 active
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "past_due",
  "canceled",
  "trialing",
]);
export const divinationTypeEnum = pgEnum("divination_type", [
  "liuyao",
  "qimen",
  "liuren",
  "xiaoliuren",
  "meihua",
  "tarot",
  "lenormand",
  "lingqian",
  "date_selection",
]);
export const planBillingIntervalEnum = pgEnum("plan_billing_interval", [
  "one_time",
  "monthly",
  "yearly",
  "free",
]);
export const entitlementResourceTypeEnum = pgEnum("entitlement_resource_type", [
  "chapter",
  "course",
]);
export const bookingTypeEnum = pgEnum("booking_type", ["one_to_one", "workshop"]);
export const workshopSessionStatusEnum = pgEnum("workshop_session_status", [
  "open",
  "closed",
  "canceled",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "canceled",
  "completed",
  "no_show",
]);

// ---- users ----
// T1.3 只建最小骨架供其他表 FK 参照；T1.4 扩充 auth 相关栏位（对齐 Auth.js AdapterUser 形状）
// passwordHash 为 Credentials provider 自行管理，非 Auth.js 内建栏位，OAuth-only 帐号可为 null

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- accounts ----
// Auth.js Drizzle adapter 标准表，供未来串接 OAuth（如 LINE Login）帐号关联；
// 栏位命名对齐 @auth/core AdapterAccount 介面（refresh_token 等为固定命名，非本专案 camelCase 惯例）

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 用 text 而非 pgEnum：@auth/drizzle-adapter 的 DefaultPostgresAccountsTable 型别要求 type 栏位是 PgText/PgVarchar
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

// ---- sessions ----
// 目前 Credentials provider 走 JWT session strategy 不会用到此表，保留供日后切换 database session strategy

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

// ---- verification_tokens ----

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

// ---- natal_chart_cache ----

export const natalChartCache = pgTable("natal_chart_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  chartSignature: text("chart_signature").notNull().unique(),
  birthDatetimeUtc: timestamp("birth_datetime_utc", { withTimezone: true }).notNull(),
  birthTimePrecision: birthTimePrecisionEnum("birth_time_precision").notNull(),
  calendarType: calendarTypeEnum("calendar_type").notNull(),
  isLeapMonth: boolean("is_leap_month"),
  gender: genderEnum("gender").notNull(),
  birthLatitude: numeric("birth_latitude", { precision: 7, scale: 4 }).notNull(),
  birthLongitude: numeric("birth_longitude", { precision: 7, scale: 4 }).notNull(),
  birthLocationName: text("birth_location_name"),
  timezoneIana: text("timezone_iana").notNull(),
  trueSolarTimeOffsetMinutes: integer("true_solar_time_offset_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- chart_engine_results ----
// 按 engine_type 拆表，理由见 .claude/specs/T1.3-db-schema-spec.md 3.3 节

export const chartEngineResults = pgTable(
  "chart_engine_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    natalChartCacheId: uuid("natal_chart_cache_id")
      .notNull()
      .references(() => natalChartCache.id),
    engineType: engineTypeEnum("engine_type").notNull(),
    resultData: jsonb("result_data").notNull(),
    engineVersion: text("engine_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chart_engine_results_chart_engine_unique").on(
      table.natalChartCacheId,
      table.engineType,
    ),
  ],
);

// ---- book_content_cache ----

export const bookContentCache = pgTable(
  "book_content_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    natalChartCacheId: uuid("natal_chart_cache_id")
      .notNull()
      .references(() => natalChartCache.id),
    chapterCode: text("chapter_code").notNull(),
    targetYear: integer("target_year"),
    targetMonth: integer("target_month"),
    contentData: jsonb("content_data").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("book_content_cache_unique").on(
      table.natalChartCacheId,
      table.chapterCode,
      table.targetYear,
      table.targetMonth,
    ),
  ],
);

// ---- user_chart_link ----

export const userChartLink = pgTable(
  "user_chart_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    natalChartCacheId: uuid("natal_chart_cache_id")
      .notNull()
      .references(() => natalChartCache.id),
    relationshipLabel: text("relationship_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_chart_link_user_id_idx").on(table.userId),
    index("user_chart_link_natal_chart_cache_id_idx").on(table.natalChartCacheId),
    uniqueIndex("user_chart_link_unique").on(
      table.userId,
      table.natalChartCacheId,
      table.relationshipLabel,
    ),
  ],
);

// ---- plans ----
// T3.4：比照 Voxel Plans/Roles 模式，可配置会员方案；规格见 .claude/specs/T3.4-membership-entitlements-spec.md

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    // 数字越大权限越高，用于「至少需要 X 级」的简单比较；理由见 spec 2.1 节
    tierLevel: integer("tier_level").notNull().default(0),
    billingInterval: planBillingIntervalEnum("billing_interval").notNull(),
    // T3.2 实作时补上：LINE Pay 定期定额需要实际扣款金额；免费方案两栏皆 null
    priceAmount: integer("price_amount"),
    priceCurrency: text("price_currency"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plans_single_default_unique").on(table.isDefault).where(sql`${table.isDefault}`),
  ],
);

// ---- plan_entitlements ----
// resource_pattern 支援 SQL LIKE 万用字元或 '*'（该 resource_type 全放行），理由见 spec 2.2 节

export const planEntitlements = pgTable(
  "plan_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    resourceType: entitlementResourceTypeEnum("resource_type").notNull(),
    resourcePattern: text("resource_pattern").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("plan_entitlements_plan_id_idx").on(table.planId),
    uniqueIndex("plan_entitlements_unique").on(
      table.planId,
      table.resourceType,
      table.resourcePattern,
    ),
  ],
);

// ---- purchases ----
// 只记录本 app 自有一次性购买（命书套餐／课程），不含 Medusa 电商订单（见 T5.1）

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    natalChartCacheId: uuid("natal_chart_cache_id").references(() => natalChartCache.id),
    productType: productTypeEnum("product_type").notNull(),
    productRef: text("product_ref").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("TWD"),
    paymentProvider: paymentProviderEnum("payment_provider").notNull(),
    paymentTransactionId: text("payment_transaction_id").notNull(),
    status: purchaseStatusEnum("status").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("purchases_user_id_idx").on(table.userId),
    index("purchases_natal_chart_cache_id_idx").on(table.natalChartCacheId),
    uniqueIndex("purchases_payment_transaction_id_unique").on(table.paymentTransactionId),
  ],
);

// ---- subscriptions ----
// planRef 已由 T3.4 的 plans 表取代，标记 deprecated 但不删除／不搬迁资料（本表建立以来尚无真实订阅写入）

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** @deprecated 由 planId 取代，见 T3.4 spec 2.3 节；保留栏位不删除，遵循 CLAUDE.md 规则四。原为 notNull，T3.4 放宽为 nullable，因表内尚无真实资料、新写入一律走 planId */
    planRef: text("plan_ref"),
    planId: uuid("plan_id").references(() => plans.id),
    status: subscriptionStatusEnum("status").notNull(),
    linepayRegKey: text("linepay_reg_key"),
    // T3.2 新增：setup 阶段（request→confirm）用来反查这笔订阅的暂时栏位，
    // 与 linepayRegKey（confirm 成功后取得，长期使用的定期定额金钥）用途不同、不可合并
    linepayTransactionId: text("linepay_transaction_id"),
    nextBillingDate: date("next_billing_date"),
    retryCount: integer("retry_count").notNull().default(0),
    lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    uniqueIndex("subscriptions_active_user_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

// ---- divination_logs ----
// 不做生辰去重共用，每次请求独立事件

export const divinationLogs = pgTable(
  "divination_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    divinationType: divinationTypeEnum("divination_type").notNull(),
    inputParams: jsonb("input_params").notNull(),
    resultData: jsonb("result_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("divination_logs_user_id_idx").on(table.userId),
    index("divination_logs_created_at_idx").on(table.createdAt),
  ],
);

// ---- booking_services ----
// T6.1：极简自建预约系统，取代 Cal.diy（授权风险放弃，见 .claude/decisions/问题清单-Caldiy商用限制.md）
// 技术规格 .claude/specs/T6.1-booking-system-spec.md 第二节

export const bookingServices = pgTable("booking_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: bookingTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // 仅 one_to_one 使用；workshop 由 workshop_sessions 各自定义起讫时间
  durationMinutes: integer("duration_minutes"),
  // one_to_one 固定 1；workshop 为预设人数上限（可被个别场次 workshop_sessions.capacity 覆写）
  capacity: integer("capacity").notNull().default(1),
  priceAmount: integer("price_amount").notNull(),
  // 预留未来多负责人扩充，本轮不使用排班分配逻辑，见 spec 一节
  providerId: uuid("provider_id").references(() => users.id),
  cancelDeadlineHours: integer("cancel_deadline_hours").notNull().default(24),
  // 期限内取消的退款比例（0~100），预设 0＝不退款；数值留给使用者拍板，见 spec 6.2 节
  lateCancelRefundPct: integer("late_cancel_refund_pct").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- availability_rules ----
// 服务提供者的每週固定可预约时段，仅 one_to_one 服务使用

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => bookingServices.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=週日…6=週六
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveUntil: date("effective_until"), // 空值＝无限期生效
  },
  (table) => [index("availability_rules_service_id_idx").on(table.serviceId)],
);

// ---- availability_exceptions ----
// 例外：请假或临时加开，仅 one_to_one 使用

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => bookingServices.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // false＝当天请假整天不开放；true＋startTime/endTime＝临时加开的额外时段
    isAvailable: boolean("is_available").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    reason: text("reason"),
  },
  (table) => [index("availability_exceptions_service_id_date_idx").on(table.serviceId, table.date)],
);

// ---- workshop_sessions ----
// 工作坊具体场次，仅 workshop 服务使用

export const workshopSessions = pgTable(
  "workshop_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => bookingServices.id, { onDelete: "cascade" }),
    sessionStartAt: timestamp("session_start_at", { withTimezone: true }).notNull(),
    sessionEndAt: timestamp("session_end_at", { withTimezone: true }).notNull(),
    // 覆写 booking_services.capacity；为空则沿用预设
    capacity: integer("capacity"),
    locationOrLink: text("location_or_link"),
    status: workshopSessionStatusEnum("status").notNull().default("open"),
  },
  (table) => [
    index("workshop_sessions_service_id_idx").on(table.serviceId),
    index("workshop_sessions_start_at_idx").on(table.sessionStartAt),
  ],
);

// ---- bookings ----
// 实际预约纪录，one_to_one／workshop 两种类型共用一张表；状态机见 spec 五节

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => bookingServices.id),
    // 仅 workshop 填写，对应 workshop_sessions
    sessionId: uuid("session_id").references(() => workshopSessions.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: bookingStatusEnum("status").notNull().default("pending"),
    // 藍新 MPG 交易序号，退款时需要；付款完成（NotifyURL 通知）后才会有值
    newebpayTradeNo: text("newebpay_trade_no"),
    // 商店订单编号，建立付款请求时的 MerchantOrderNo
    newebpayMerchantOrderNo: text("newebpay_merchant_order_no").notNull(),
    customerNote: text("customer_note"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("bookings_service_id_idx").on(table.serviceId),
    index("bookings_session_id_idx").on(table.sessionId),
    index("bookings_user_id_idx").on(table.userId),
    uniqueIndex("bookings_merchant_order_no_unique").on(table.newebpayMerchantOrderNo),
    // 防重复预约第一道防线（one_to_one）：同服务同时段只能有一笔 pending/confirmed 预约，
    // workshop 靠人数上限而非唯一时段限制，见 spec 四节
    uniqueIndex("bookings_one_to_one_slot_unique")
      .on(table.serviceId, table.startAt)
      .where(sql`${table.status} IN ('pending', 'confirmed')`),
  ],
);
