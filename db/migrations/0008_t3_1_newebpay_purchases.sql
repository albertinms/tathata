-- T3.1：LINE Pay 棄用改採藍新金流，purchases 表栏位重命名（表内目前 0 笔资料，直接改名不做资料迁移）
-- 见 .claude/specs/T3.1-T3.2-newebpay-spec.md 三节

DROP INDEX "purchases_payment_transaction_id_unique";--> statement-breakpoint
ALTER TABLE "purchases" RENAME COLUMN "payment_transaction_id" TO "newebpay_merchant_order_no";--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "newebpay_trade_no" text;--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_merchant_order_no_unique" ON "purchases" USING btree ("newebpay_merchant_order_no");--> statement-breakpoint

ALTER TYPE "public"."payment_provider" RENAME VALUE 'linepay' TO 'newebpay_mpg';--> statement-breakpoint
ALTER TYPE "public"."payment_provider" ADD VALUE 'newebpay_period';