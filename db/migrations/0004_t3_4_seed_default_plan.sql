-- 免费 fallback plan：新注册用户预设指派此方案，详见 .claude/specs/T3.4-membership-entitlements-spec.md 第 5 节
-- 实际方案笔数与规则待经营决策后另行 INSERT，这里只保证「一定有一个免费方案存在」这个不变量
INSERT INTO "plans" ("code", "name", "tier_level", "billing_interval", "is_default", "is_active")
VALUES ('free', '免费方案', 0, 'free', true, true)
ON CONFLICT ("code") DO NOTHING;
