CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'canceled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('one_to_one', 'workshop');--> statement-breakpoint
CREATE TYPE "public"."workshop_session_status" AS ENUM('open', 'closed', 'canceled');--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_available" boolean NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "booking_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer,
	"capacity" integer DEFAULT 1 NOT NULL,
	"price_amount" integer NOT NULL,
	"provider_id" uuid,
	"cancel_deadline_hours" integer DEFAULT 24 NOT NULL,
	"late_cancel_refund_pct" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"newebpay_trade_no" text,
	"newebpay_merchant_order_no" text NOT NULL,
	"customer_note" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workshop_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"session_start_at" timestamp with time zone NOT NULL,
	"session_end_at" timestamp with time zone NOT NULL,
	"capacity" integer,
	"location_or_link" text,
	"status" "workshop_session_status" DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_workshop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workshop_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_sessions" ADD CONSTRAINT "workshop_sessions_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exceptions_service_id_date_idx" ON "availability_exceptions" USING btree ("service_id","date");--> statement-breakpoint
CREATE INDEX "availability_rules_service_id_idx" ON "availability_rules" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "bookings_service_id_idx" ON "bookings" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "bookings_session_id_idx" ON "bookings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_merchant_order_no_unique" ON "bookings" USING btree ("newebpay_merchant_order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_one_to_one_slot_unique" ON "bookings" USING btree ("service_id","start_at") WHERE "bookings"."status" IN ('pending', 'confirmed');--> statement-breakpoint
CREATE INDEX "workshop_sessions_service_id_idx" ON "workshop_sessions" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "workshop_sessions_start_at_idx" ON "workshop_sessions" USING btree ("session_start_at");