# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [v0.1.0] - 2026-08-19

### 新增

- **robotik-sdk**：可嵌入任意 Web 应用的悬浮对话机器人 SDK（Shadow DOM 隔离 · 拖拽 · SSE 流式 · 工具调用）
  - 声明式（`<script>` 一行接入）与编程式（`init()`）两种接入
  - 登录态桥接（`localStorage['web_robot.session']` + storage 事件）
  - IndexedDB 本地历史（按 `appId + userId` 隔离）
  - 拖拽定位 + 位置记忆 + 主题（主色 / 明暗 / 四角位置）
  - 自定义能力：`locale` 国际化、`renderMessage`/`markdown` 渲染、`icon` 头像、`headers`/`fetchImpl`/`timeout` 网络、`beforeSend` 钩子、`autoOpen`
  - 打包产物：UMD（`robot.js`）+ ESM（`robot.mjs`）+ 单文件类型声明（rollup-plugin-dts）
- **robotik-server**：NestJS 对话后端（JWKS 本地验签 + DeepSeek 工具循环 + SSE 流式）
  - 工具注册表 + `site_configs.allowed_tools` 白名单
  - 内置工具 `get_time` / `echo` / `calculate`；知识库工具 `search_knowledge` / `get_document_detail` / `list_categories`
  - 限流 + 并发锁可插拔（默认内存，`REDIS_URL` 启用 Redis 支持多实例）
  - mock 降级模式（未配置 `DEEPSEEK_API_KEY` 时）
- **robotik-admin**：React 19 + Vite 6 + Tailwind 4 管理后台（Dashboard / 应用管理 / 会话洞察 / 管理员）
- **apps/knowledge**：知识库测试应用（多 schema 工具调用链路演示）
- 数据库迁移：`robotik` 与 `knowledge` 两套 schema + RLS

### 修复

- 内置工具注册落空（`BuiltinToolsModule` 自带 `providers` 遮蔽全局实例，导致 default 应用工具链失效）
- knowledge 模块越权（改用用户 JWT 透传，去除 `SUPABASE_SERVICE_ROLE_KEY` 直连）
- LLM 伪流式（`stream: false` 切片）改为真流式 `stream: true`
- 客户端断连无取消（新增 `AbortController` 贯穿 controller → service → LLM）
- `usage_logs` RLS 收紧（`WITH CHECK (true)` → `auth.uid() = user_id`）
- SDK `loadHistory` 竞态与 destroy 后写 DOM
- knowledge 应用 `init()` 返回 `undefined` 的类型错误

### 安全

- 全局关闭 TLS 校验改为环境变量开关 `DEEPSEEK_INSECURE_TLS`（默认不关闭）
- 新增 `.gitignore` 排除 `.env` / `node_modules` / `dist` / `.npmrc`
- 新增各包 `.env.example` 模板（占位符）
- `apps/knowledge` 的 Supabase 配置改为 `import.meta.env` 环境变量
- SDK 内置 Markdown 渲染「先转义再替换 + 链接协议白名单」，XSS 面可控

### 变更

- SDK 打包产物：IIFE → UMD（覆盖 `<script>`/AMD/CommonJS），ESM 改为 `.mjs`
- 关闭 sourcemap 与 declarationMap，`.d.ts` 收敛为单文件（17 → 1）
- 移除未实现的 `Transport` / `TransportAdapter` 死类型
