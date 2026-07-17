-- T3.2／T3.3：LINE Pay 棄用改採藍新金流定期定额，subscriptions 表栏位重命名＋新增
-- （表内目前 0 笔资料，直接改名不做资料迁移），见 .claude/specs/T3.1-T3.2-newebpay-spec.md 三节

ALTER TABLE "subscriptions" RENAME COLUMN "linepay_transaction_id" TO "newebpay_mer_order_no";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "newebpay_mer_order_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME COLUMN "linepay_reg_key" TO "newebpay_period_no";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "newebpay_trade_no" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "newebpay_next_auth_date" date;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "newebpay_already_times" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "newebpay_total_times" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_mer_order_no_unique" ON "subscriptions" USING btree ("newebpay_mer_order_no");