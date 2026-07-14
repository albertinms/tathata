CREATE TYPE "public"."entitlement_resource_type" AS ENUM('chapter', 'course');--> statement-breakpoint
CREATE TYPE "public"."plan_billing_interval" AS ENUM('one_time', 'monthly', 'yearly', 'free');--> statement-breakpoint
CREATE TABLE "plan_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"resource_type" "entitlement_resource_type" NOT NULL,
	"resource_pattern" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tier_level" integer DEFAULT 0 NOT NULL,
	"billing_interval" "plan_billing_interval" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "plan_ref" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_entitlements_plan_id_idx" ON "plan_entitlements" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_entitlements_unique" ON "plan_entitlements" USING btree ("plan_id","resource_type","resource_pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_single_default_unique" ON "plans" USING btree ("is_default") WHERE "plans"."is_default";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;