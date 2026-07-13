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
export const subscriptionStatusEnum = pgEnum("subscription_status", [
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
// plan_ref 暂不建 FK，等 T3.4 的 plans 表落地后另补 migration

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    planRef: text("plan_ref").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    linepayRegKey: text("linepay_reg_key"),
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
