-- Robotik P2 安全加固
-- 1. usage_logs RLS 收紧：仅允许登录用户写入自己的记录（防伪造他人/刷统计）
-- 2. usage_logs.status 加 CHECK 约束（对齐 P1 引入的 aborted 状态）
-- 3. 说明：site_configs 的 anon SELECT 保留——后端 SiteConfigService 以 anon key 读取
--    （allowed_tools/theme 非密钥，泄露面低；如需收敛可改为受限视图）

-- ============================================================
-- 1. usage_logs INSERT 收紧
-- ============================================================

DROP POLICY IF EXISTS "robotik_usage_logs_insert" ON robotik.usage_logs;
CREATE POLICY "robotik_usage_logs_insert" ON robotik.usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. status 约束
-- ============================================================

ALTER TABLE robotik.usage_logs
  DROP CONSTRAINT IF EXISTS robotik_usage_logs_status_check;
ALTER TABLE robotik.usage_logs
  ADD CONSTRAINT robotik_usage_logs_status_check
  CHECK (status IN ('success', 'error', 'aborted'));
