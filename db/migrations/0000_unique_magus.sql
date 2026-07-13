CREATE TYPE "public"."birth_time_precision" AS ENUM('exact', 'estimated', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."calendar_type" AS ENUM('solar', 'lunar');--> statement-breakpoint
CREATE TYPE "public"."divination_type" AS ENUM('liuyao', 'qimen', 'liuren', 'xiaoliuren', 'meihua', 'tarot', 'lenormand', 'lingqian', 'date_selection');--> statement-breakpoint
CREATE TYPE "public"."engine_type" AS ENUM('bazi', 'ziwei', 'astrology', 'human_design', 'numerology');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('linepay');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('book_package', 'course');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'trialing');--> statement-breakpoint
CREATE TABLE "book_content_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"natal_chart_cache_id" uuid NOT NULL,
	"chapter_code" text NOT NULL,
	"target_year" integer,
	"target_month" integer,
	"content_data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_engine_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"natal_chart_cache_id" uuid NOT NULL,
	"engine_type" "engine_type" NOT NULL,
	"result_data" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divination_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"divination_type" "divination_type" NOT NULL,
	"input_params" jsonb NOT NULL,
	"result_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "natal_chart_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chart_signature" text NOT NULL,
	"birth_datetime_utc" timestamp with time zone NOT NULL,
	"birth_time_precision" "birth_time_precision" NOT NULL,
	"calendar_type" "calendar_type" NOT NULL,
	"is_leap_month" boolean,
	"gender" "gender" NOT NULL,
	"birth_latitude" numeric(7, 4) NOT NULL,
	"birth_longitude" numeric(7, 4) NOT NULL,
	"birth_location_name" text,
	"timezone_iana" text NOT NULL,
	"true_solar_time_offset_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "natal_chart_cache_chart_signature_unique" UNIQUE("chart_signature")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"natal_chart_cache_id" uuid,
	"product_type" "product_type" NOT NULL,
	"product_ref" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'TWD' NOT NULL,
	"payment_provider" "payment_provider" NOT NULL,
	"payment_transaction_id" text NOT NULL,
	"status" "purchase_status" NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_ref" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"linepay_reg_key" text,
	"next_billing_date" date,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_payment_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chart_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"natal_chart_cache_id" uuid NOT NULL,
	"relationship_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "book_content_cache" ADD CONSTRAINT "book_content_cache_natal_chart_cache_id_natal_chart_cache_id_fk" FOREIGN KEY ("natal_chart_cache_id") REFERENCES "public"."natal_chart_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_engine_results" ADD CONSTRAINT "chart_engine_results_natal_chart_cache_id_natal_chart_cache_id_fk" FOREIGN KEY ("natal_chart_cache_id") REFERENCES "public"."natal_chart_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divination_logs" ADD CONSTRAINT "divination_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_natal_chart_cache_id_natal_chart_cache_id_fk" FOREIGN KEY ("natal_chart_cache_id") REFERENCES "public"."natal_chart_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chart_link" ADD CONSTRAINT "user_chart_link_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chart_link" ADD CONSTRAINT "user_chart_link_natal_chart_cache_id_natal_chart_cache_id_fk" FOREIGN KEY ("natal_chart_cache_id") REFERENCES "public"."natal_chart_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_content_cache_unique" ON "book_content_cache" USING btree ("natal_chart_cache_id","chapter_code","target_year","target_month");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_engine_results_chart_engine_unique" ON "chart_engine_results" USING btree ("natal_chart_cache_id","engine_type");--> statement-breakpoint
CREATE INDEX "divination_logs_user_id_idx" ON "divination_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "divination_logs_created_at_idx" ON "divination_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchases_user_id_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchases_natal_chart_cache_id_idx" ON "purchases" USING btree ("natal_chart_cache_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_payment_transaction_id_unique" ON "purchases" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_active_user_unique" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "user_chart_link_user_id_idx" ON "user_chart_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_chart_link_natal_chart_cache_id_idx" ON "user_chart_link" USING btree ("natal_chart_cache_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_chart_link_unique" ON "user_chart_link" USING btree ("user_id","natal_chart_cache_id","relationship_label");