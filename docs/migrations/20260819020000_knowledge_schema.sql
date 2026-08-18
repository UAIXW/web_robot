-- Knowledge: 知识库测试应用 schema
-- 独立 schema,用于测试 SDK 的工具调用链路
-- app_id = 'knowledge' 的应用会加载知识库工具

CREATE SCHEMA IF NOT EXISTS knowledge;

-- ============================================================
-- 1. 文档表
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(64) NOT NULL DEFAULT 'knowledge',
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category VARCHAR(64) NOT NULL DEFAULT '通用',
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_app ON knowledge.documents(app_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON knowledge.documents(app_id, category);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_search ON knowledge.documents
  USING gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

-- ============================================================
-- 2. 触发器
-- ============================================================

CREATE OR REPLACE FUNCTION knowledge.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_documents_touch
BEFORE UPDATE ON knowledge.documents
FOR EACH ROW EXECUTE FUNCTION knowledge.touch_updated_at();

-- ============================================================
-- 3. RLS: 管理员可写,所有登录用户可读已发布文档
-- ============================================================

ALTER TABLE knowledge.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_docs_read_published" ON knowledge.documents
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "knowledge_docs_admin_all" ON knowledge.documents
  FOR ALL TO authenticated
  USING (robotik.is_admin())
  WITH CHECK (robotik.is_admin());

-- ============================================================
-- 4. 权限
-- ============================================================

GRANT USAGE ON SCHEMA knowledge TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA knowledge TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA knowledge TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================================
-- 5. 种子数据:几篇 FAQ 文档
-- ============================================================

INSERT INTO knowledge.documents (app_id, title, content, category, status, created_by)
SELECT 'knowledge', title, content, category, 'published', id
FROM auth.users, (VALUES
  ('Robotik SDK 是什么？',
   'Robotik SDK 是一个可嵌入任意 Web 应用的悬浮对话机器人 SDK。支持拖拽定位、Shadow DOM 隔离、SSE 流式响应、IndexedDB 本地存储。',
   '产品说明'),
  ('如何接入 SDK？',
   '声明式接入：在页面添加 script 标签，设置 data-app-id 和 data-server 属性即可。编程式接入：调用 init({ appId, server }) 方法。',
   '使用指南'),
  ('SDK 支持哪些框架？',
   'SDK 本身是框架无关的纯 TypeScript 库。官方提供了 Vue3 组件和 React Hook 适配器。其他框架可直接调用 init API。',
   '使用指南'),
  ('工具调用是什么？',
   '工具调用是 LLM 通过函数调用来获取外部数据或执行操作的能力。SDK 会在 UI 上显示工具调用状态（⚙ 图标），支持多轮调用。',
   '技术概念'),
  ('SSE 流式响应怎么工作？',
   '后端通过 Server-Sent Events 协议推送事件流：tool_call → tool_result → delta（分块文本）→ done。SDK 自动解析并渲染。',
   '技术概念'),
  ('如何配置工具白名单？',
   '在 robotik 管理后台的站点配置页面，编辑 allowed_tools 字段，添加工具名称即可。未在白名单中的工具会被拒绝执行。',
   '使用指南'),
  ('本地存储用了什么？',
   'SDK 使用 IndexedDB（通过 idb 库）存储对话历史，按 appId + userId 隔离。支持最近 50 条消息启动时自动回显。',
   '技术概念')
) AS t(title, content, category)
WHERE email = 'demo@webrobot.dev'
ON CONFLICT DO NOTHING;
