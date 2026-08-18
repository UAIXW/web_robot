-- Robotik: SDK 运营管理平台 schema
-- 1. 删除旧 web_robot 业务表(积分/奖品/兑换),保留核心基础设施
-- 2. 将核心表迁移到 robotik schema
-- 3. 新增 usage_logs 表(AI 调用日志)
-- 4. 重写 stats_overview() 为 SDK 运营统计

-- ============================================================
-- 1. 删除旧 web_robot 业务表和函数
-- ============================================================

DROP FUNCTION IF EXISTS web_robot.redeem_prize(UUID) CASCADE;
DROP FUNCTION IF EXISTS web_robot.on_new_user() CASCADE;
DROP TRIGGER IF EXISTS web_robot_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS web_robot.on_new_user() CASCADE;
DROP VIEW IF EXISTS web_robot.user_points CASCADE;
DROP TABLE IF EXISTS web_robot.redemptions CASCADE;
DROP TABLE IF EXISTS web_robot.prizes CASCADE;
DROP TABLE IF EXISTS web_robot.points_ledger CASCADE;

-- ============================================================
-- 2. 创建 robotik schema,迁移核心表
-- ============================================================

CREATE SCHEMA IF NOT EXISTS robotik;

-- 站点配置:每个接入应用一行
CREATE TABLE IF NOT EXISTS robotik.site_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(64) UNIQUE NOT NULL,
  site_domain VARCHAR(255) DEFAULT '*',
  robot_name VARCHAR(64) NOT NULL DEFAULT '小助手',
  welcome_text TEXT DEFAULT '',
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_position JSONB NOT NULL DEFAULT '{"x": 24, "y": 24}'::jsonb,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话管理
CREATE TABLE IF NOT EXISTS robotik.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_robotik_conversations_user ON robotik.conversations(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_robotik_conversations_app ON robotik.conversations(app_id, created_at DESC);

-- 消息历史(含工具调用记录)
CREATE TABLE IF NOT EXISTS robotik.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES robotik.conversations(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_name VARCHAR(64),
  tool_args JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_robotik_messages_conv ON robotik.messages(conversation_id, id);

-- AI 调用日志:每次 SDK 请求的元数据
CREATE TABLE IF NOT EXISTS robotik.usage_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL,
  conversation_id UUID REFERENCES robotik.conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model VARCHAR(64) NOT NULL DEFAULT '',
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  tool_calls INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_robotik_usage_app ON robotik.usage_logs(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robotik_usage_user ON robotik.usage_logs(user_id, created_at DESC);

-- ============================================================
-- 3. 管理员体系
-- ============================================================

CREATE TABLE IF NOT EXISTS robotik.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. 辅助函数
-- ============================================================

CREATE OR REPLACE FUNCTION robotik.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = robotik
AS $$ SELECT EXISTS (SELECT 1 FROM robotik.admins WHERE user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION robotik.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER robotik_site_configs_touch
BEFORE UPDATE ON robotik.site_configs
FOR EACH ROW EXECUTE FUNCTION robotik.touch_updated_at();

CREATE TRIGGER robotik_conversations_touch
BEFORE UPDATE ON robotik.conversations
FOR EACH ROW EXECUTE FUNCTION robotik.touch_updated_at();

-- ============================================================
-- 5. stats_overview(): SDK 运营统计
-- ============================================================

CREATE OR REPLACE FUNCTION robotik.stats_overview()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = robotik
AS $$
  SELECT CASE WHEN robotik.is_admin() THEN jsonb_build_object(
    'apps_total', (SELECT COUNT(*) FROM robotik.site_configs WHERE is_active),
    'apps_active_today', (SELECT COUNT(DISTINCT app_id) FROM robotik.conversations WHERE created_at >= date_trunc('day', NOW())),
    'conversations_total', (SELECT COUNT(*) FROM robotik.conversations),
    'conversations_today', (SELECT COUNT(*) FROM robotik.conversations WHERE created_at >= date_trunc('day', NOW())),
    'messages_total', (SELECT COUNT(*) FROM robotik.messages),
    'messages_today', (SELECT COUNT(*) FROM robotik.messages WHERE created_at >= date_trunc('day', NOW())),
    'tool_calls_total', (SELECT COUNT(*) FROM robotik.messages WHERE role = 'tool'),
    'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM robotik.conversations WHERE created_at >= date_trunc('day', NOW())),
    'tokens_input_total', (SELECT COALESCE(SUM(input_tokens), 0) FROM robotik.usage_logs),
    'tokens_output_total', (SELECT COALESCE(SUM(output_tokens), 0) FROM robotik.usage_logs),
    'avg_latency_ms', (SELECT COALESCE(AVG(latency_ms), 0)::INT FROM robotik.usage_logs WHERE status = 'success'),
    'error_rate', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status = 'error'))::NUMERIC / COUNT(*) * 100, 2)
        ELSE 0 END
      FROM robotik.usage_logs
    )
  ) ELSE jsonb_build_object('error', 'not_admin') END;
$$;

-- ============================================================
-- 6. 管理员管理 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION robotik.add_admin_by_email(p_email text)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = robotik
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NOT robotik.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'message', '仅管理员可执行');
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '用户不存在：' || p_email);
  END IF;
  INSERT INTO robotik.admins (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION robotik.remove_admin(p_user_id uuid)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = robotik
AS $$
BEGIN
  IF NOT robotik.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'message', '仅管理员可执行');
  END IF;
  DELETE FROM robotik.admins WHERE user_id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE VIEW robotik.admin_list AS
SELECT a.user_id, a.role, a.created_at, u.email
FROM robotik.admins a
JOIN auth.users u ON u.id = a.user_id;

-- ============================================================
-- 7. RLS 行级安全
-- ============================================================

ALTER TABLE robotik.site_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robotik_site_configs_read" ON robotik.site_configs
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "robotik_site_configs_admin_all" ON robotik.site_configs
  FOR ALL TO authenticated USING (robotik.is_admin()) WITH CHECK (robotik.is_admin());

ALTER TABLE robotik.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robotik_conversations_owner" ON robotik.conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "robotik_conversations_admin_read" ON robotik.conversations
  FOR SELECT TO authenticated USING (robotik.is_admin());

ALTER TABLE robotik.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robotik_messages_read" ON robotik.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM robotik.conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "robotik_messages_insert" ON robotik.messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM robotik.conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "robotik_messages_admin_read" ON robotik.messages
  FOR SELECT TO authenticated USING (robotik.is_admin());

ALTER TABLE robotik.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robotik_usage_logs_admin_read" ON robotik.usage_logs
  FOR SELECT TO authenticated USING (robotik.is_admin());
CREATE POLICY "robotik_usage_logs_insert" ON robotik.usage_logs
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE robotik.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "robotik_admins_self_read" ON robotik.admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "robotik_admins_admin_read" ON robotik.admins
  FOR SELECT TO authenticated USING (robotik.is_admin());

-- ============================================================
-- 8. 权限授予
-- ============================================================

GRANT USAGE ON SCHEMA robotik TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA robotik TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA robotik TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA robotik TO anon, authenticated, service_role;

REVOKE ALL ON robotik.admins FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON robotik.admins FROM authenticated;
GRANT SELECT ON robotik.admins TO authenticated;

REVOKE EXECUTE ON FUNCTION robotik.stats_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION robotik.stats_overview() TO authenticated;

REVOKE EXECUTE ON FUNCTION robotik.add_admin_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION robotik.add_admin_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION robotik.remove_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION robotik.remove_admin(uuid) TO authenticated;

GRANT SELECT ON robotik.admin_list TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA robotik
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA robotik
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA robotik
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ============================================================
-- 9. 种子数据
-- ============================================================

INSERT INTO robotik.site_configs (app_id, site_domain, robot_name, welcome_text, allowed_tools)
VALUES
  ('default', '*', '小助手', '你好！我是你的 AI 助手 🤖\n可以把我拖到任意位置，点击收起。', '["get_time", "echo", "calculate"]'::jsonb),
  ('knowledge', '*', '知识库助手', '你好！我可以帮你检索知识库 📚\n试试问："有哪些分类？" 或 "搜索 SDK 相关文档"', '["search_knowledge", "get_document_detail", "list_categories"]'::jsonb)
ON CONFLICT (app_id) DO NOTHING;

-- 迁移旧管理员
INSERT INTO robotik.admins (user_id, role)
SELECT user_id, role FROM web_robot.admins
ON CONFLICT (user_id) DO NOTHING;

-- 迁移旧会话和消息
INSERT INTO robotik.conversations (id, app_id, user_id, title, created_at, updated_at)
SELECT id, app_id, user_id, title, created_at, updated_at
FROM web_robot.conversations
ON CONFLICT DO NOTHING;

INSERT INTO robotik.messages (conversation_id, role, content, tool_name, tool_args, created_at)
SELECT conversation_id, role, content, tool_name, tool_args, created_at
FROM web_robot.messages
ON CONFLICT DO NOTHING;

-- demo 账号设为管理员
INSERT INTO robotik.admins (user_id)
SELECT id FROM auth.users WHERE email = 'demo@webrobot.dev'
ON CONFLICT (user_id) DO NOTHING;
