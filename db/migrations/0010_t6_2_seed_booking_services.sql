-- T6.2：预约系统服务项目与可预约规则的示例资料，见 .claude/specs/T6.1-booking-system-spec.md 第九节。
-- 与 0004_t3_4_seed_default_plan.sql（免费方案）同一精神：占位示例资料，非真实营运内容，
-- 实际服务项目／价格／时段由使用者上线前拍板后另行调整（比照 T0.5 会员分级模式，非阻断）。

WITH new_service AS (
  INSERT INTO "booking_services"
    ("type", "name", "description", "duration_minutes", "capacity", "price_amount", "cancel_deadline_hours")
  VALUES
    ('one_to_one', '塔羅談詢 30 分鐘', '一對一塔羅牌談詢，線上進行', 30, 1, 1200, 24)
  RETURNING "id"
)
INSERT INTO "availability_rules" ("service_id", "day_of_week", "start_time", "end_time", "effective_from")
SELECT "id", 2, '14:00:00'::time, '18:00:00'::time, CURRENT_DATE FROM new_service
UNION ALL
SELECT "id", 4, '14:00:00'::time, '18:00:00'::time, CURRENT_DATE FROM new_service;
--> statement-breakpoint

WITH new_workshop AS (
  INSERT INTO "booking_services"
    ("type", "name", "description", "capacity", "price_amount", "cancel_deadline_hours")
  VALUES
    ('workshop', '占星入門工作坊', '團體工作坊，線上進行，人數上限見場次設定', 10, 2400, 48)
  RETURNING "id"
)
INSERT INTO "workshop_sessions" ("service_id", "session_start_at", "session_end_at", "location_or_link", "status")
SELECT
  "id",
  ((CURRENT_DATE + INTERVAL '14 days')::date + TIME '14:00:00') AT TIME ZONE 'Asia/Taipei',
  ((CURRENT_DATE + INTERVAL '14 days')::date + TIME '16:00:00') AT TIME ZONE 'Asia/Taipei',
  '線上視訊連結（報名後另行通知）',
  'open'
FROM new_workshop;