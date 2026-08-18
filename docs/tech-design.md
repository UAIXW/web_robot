# Web Robot 技术方案

> 版本 v1.0 · 2026-08-18 · 本文件是项目技术决策的唯一真相源，变更需同步更新

## 1. 产品定义

可嵌入任意 Web 应用的悬浮对话机器人：宿主应用引一行 `<script>` 即可拥有一个可拖拽的机器人，登录用户通过自然语言查询和操作自己的数据（积分、奖品、兑换等），后端由 DeepSeek 驱动工具调用，数据权限由 Supabase RLS 兜底。

- 目标用户：宿主应用的登录用户（复用宿主登录态）
- 多应用：同一套 SDK + 同一个 Node 后端服务多个应用，按 `app_id` 区分配置与工具白名单

## 2. 架构总览

```
浏览器（宿主应用）
  └─ SDK robot.js（Shadow DOM 隔离）
       ├─ 悬浮机器人：拖拽 / 点击 / 位置记忆
       ├─ 对话面板：SSE 流式渲染
       └─ 登录态桥接：localStorage["web_robot.session"]
            │ POST /chat  (Bearer 用户JWT, app_id)
            ▼
Node 后端（NestJS 单服务，多应用共用）
  ├─ AuthGuard：jose + JWKS 本地验签
  ├─ ChatService：SSE 推流 + 工具循环编排
  ├─ ToolRegistry：按 app 白名单注册工具
  └─ DeepSeekClient：openai SDK（baseURL 指向 DeepSeek）
            │ tool_calls 执行时透传用户 JWT
            ▼
Supabase（web_robot schema）
  ├─ PostgREST（读，RLS 过滤）
  ├─ RPC redeem_prize 等（写，原子事务）
  └─ Auth JWKS（后端验签公钥来源）
```

两条主链路：

1. **对话链路**：SDK 携带宿主登录态调后端 `/chat`；后端验签后把问题与工具定义发给 DeepSeek；DeepSeek 返回 `tool_calls`；后端以用户身份执行工具；结果回传 DeepSeek；循环直至最终回答，全程 SSE 推流。
2. **数据链路**：后端执行工具时使用**用户自己的 JWT** 调 Supabase，RLS 在数据库层过滤——后端自身不持有任何越权能力。

## 3. 关键决策记录

| # | 决策点 | 定稿 | 放弃项 | 理由 |
|---|---|---|---|---|
| D1 | 交付形态 | JS SDK，`<script>` 一行接入 | 浏览器插件 / 桌面悬浮窗 | 无需分发渠道；覆盖 App 内嵌 H5；Shadow DOM 保证与宿主互不污染 |
| D2 | 对话后端 | 自建 NestJS（Node 20+） | Supabase Edge Function | 断点/热重载调试体验；单服务多应用路由；未来迁移自由（对话逻辑与传输层分离） |
| D3 | 数据访问 | supabase-js 透传用户 JWT | Prisma 直连 | Prisma 以超级用户跑 SQL，绕过 RLS；且与 supabase/migrations 形成双 schema 真相源 |
| D4 | LLM | DeepSeek（openai SDK baseURL） | 专有 SDK | OpenAI 兼容接口；密钥仅存后端 env；可随时切换任何兼容服务 |
| D5 | 写操作 | 仅暴露 RPC | LLM 生成 SQL 执行 | 原子性、权限、审计全部数据库层兜底；LLM 只见受限工具 |
| D6 | 流式协议 | SSE | WebSocket | 单向流足够；HTTP 语义、代理兼容、断线重连更简单 |
| D7 | 降级策略 | 后端不可达 → SDK 本地规则模式 | 强依赖后端 | 已实现；演示、断网、后端故障均有兜底 |
| D8 | 校验 | class-validator | joi（移除） | NestJS 生态原生集成，管道统一处理 |

## 4. 后端设计（NestJS）

### 4.1 模块划分

```
server/src/
├── auth/        SupabaseJwtGuard（jose createRemoteJWKSet 验签，附加 req.user = { uid, email }）
├── chat/        POST /v1/chat（SSE 响应）；会话历史裁剪（最近 N 轮）
├── tools/       ToolRegistry + 每工具一个类（name/desc/parameters(zod→json schema)/execute(userJwt, args)）
├── llm/         DeepSeekClient（openai SDK）；系统提示词模板（含表结构摘要）
└── config/      AppSiteConfigService（读 site_configs，缓存 + TTL）
```

### 4.2 接口

```
POST /v1/chat
Headers: Authorization: Bearer <supabase 用户JWT>
Body:    { app_id, conversation_id?, message }
返回:    text/event-stream
```

SSE 事件协议：

| event | data | 说明 |
|---|---|---|
| `delta` | `{ text }` | 回答增量（打字机） |
| `tool_call` | `{ name, args }` | 面板显示"正在查询积分…" |
| `tool_result` | `{ name, ok, summary }` | 工具执行结果摘要 |
| `done` | `{ conversation_id, message_id }` | 结束，返回会话 ID 供续聊 |
| `error` | `{ code, message }` | 401 由 SDK 触发重登提示 |

### 4.3 工具清单（M1/M2）

| 工具 | 类型 | 实现 | 白名单键 |
|---|---|---|---|
| 查询积分余额 | 读 | GET user_points | `query_points` |
| 查询奖品列表 | 读 | GET prizes | `query_prizes` |
| 查询积分流水 | 读 | GET points_ledger | `query_ledger` |
| 兑换奖品 | 写 | POST rpc/redeem_prize | `redeem_prize` |

全部工具执行时：`Accept-Profile: web_robot`、`Authorization: 用户JWT`。写工具结果由 RPC 的 `{ok, message}` 直接驱动回复文案。

## 5. 安全设计

- 密钥边界：`DEEPSEEK_API_KEY` 仅后端 env；`service_role` key 全链路禁止出现；前端只有 publishable key
- 验签：JWKS 本地验签（`/.well-known/jwks.json`），不远程调 `auth.getUser()`（省一次网络往返）
- 工具白名单：`site_configs.allowed_tools` 按 app 生效；未注册/未授权的工具调用直接拒绝并审计
- 参数校验：class-validator DTO；LLM 给出的参数不合法时回错误文案让它自行纠正
- 限流：MVP 内存令牌桶（per-uid 并发 1、每分钟 20 条）；后续可换 ioredis
- 审计：messages 表已有 `tool_name/tool_args`；工具执行日志复用该机制
- 输入约束：消息长度 ≤ 200 字符（SDK 端已限）；历史窗口 ≤ 10 轮

## 6. SDK 设计要点

- **通用内核，零业务逻辑**：SDK 只提供拖拽/面板/SSE/本地存储/事件总线；积分、奖品、站点配置等业务全部由宿主通过 `init({ fallback, toolLabels })` 注入（参考 `demo/business.js`）
- 两种接入：声明式 `data-app-id / data-server`（纯 AI 模式）；编程式 `WebRobotSDK.init()` / `import { init } from '@webrobot/sdk'`（可注入业务回调）
- 登录态桥接：宿主登录后写 `localStorage["web_robot.session"]`；SDK 监听 `storage` 事件实时感知登入登出
- SSE 消费：`fetch` + ReadableStream 解析（避免 EventSource 不能带 Authorization 头的问题）
- 降级：后端不可达 → 宿主注入的 `fallback` 回调接管；401 → 提示重新登录
- 本地历史：IndexedDB（idb）按 `appId + userId` 隔离，回显最近 50 条；云端持久化由后端（AI 模式）或宿主 `fallback` 内自行写入（本地模式）

## 7. 里程碑

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| M1 | NestJS 骨架 + JWT 验签 + SSE 透传 DeepSeek（无工具） | SDK 面板流式显示 DeepSeek 回复 |
| M2 | 工具循环（3 读 + 1 写）+ 会话入库 | "兑换 贴纸"全链路走通，会话历史 Tab 可见 |
| M3 | 多应用配置 | site_configs 白名单生效，第二 app 只开放读工具 |
| M4 | 生产化 | 限流、审计查询、SDK 打包单文件、部署脚本 |

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| DeepSeek 工具调用参数不稳 | 系统提示词附表结构与字段说明；temperature 0.2；参数校验失败回传错误让模型自纠 |
| SSE 被代理断流 | 每 15s 心跳注释行；SDK 断流自动降级本地模式 |
| 用户 JWT 过期 | 后端 401；SDK 提示重登（宿主 refresh 后 storage 事件自动恢复） |
| 工具循环死循环 | 最大 5 轮工具调用，超限强制以现状作答 |
| Supabase 本地与云端差异 | 迁移文件即真相源；`.env` 区分 local/cloud 配置 |

## 9. 环境变量（后端）

```
PORT=8787
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=sb_publishable_xxx
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```
