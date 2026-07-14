ALTER TYPE "public"."subscription_status" ADD VALUE 'pending' BEFORE 'active';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "linepay_transaction_id" text;