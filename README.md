# Robotik

可嵌入任意 Web 应用的悬浮对话机器人 SDK 平台:拖拽、点击对话、AI 工具调用、SSE 流式响应。

## 目录结构

```
robotik/
├── robotik-sdk/                # 通用 SDK（TS 源码 → Vite 构建，Shadow DOM 隔离）
│   ├── src/core/               # init 装配 / 配置 / 事件总线（零业务逻辑）
│   ├── src/ui/                 # Shadow DOM 模板 / 拖拽 / 主题
│   ├── src/transport/          # SSE 流式解析
│   ├── src/storage/            # IndexedDB 消息存储（idb）
│   ├── src/auth/               # 登录态适配器（默认 localStorage）
│   └── dist/                   # robot.js（UMD）/ robot.mjs（ESM）+ 类型声明
├── robotik-server/             # 通用后端（NestJS）：JWT 验签 + 工具循环 + SSE
│   ├── src/auth/               # Supabase JWT Guard（JWKS 验签）
│   ├── src/chat/               # POST /v1/chat：SSE 流式 + usage_logs 记录
│   ├── src/llm/                # DeepSeek 客户端 + mock 降级
│   ├── src/tools/              # 工具注册表 + builtin/ 内置调试工具
│   ├── src/apps/knowledge/     # 知识库工具模块（可插拔）
│   └── src/config/             # site_configs 站点配置（工具白名单）
├── robotik-admin/              # 管理后台（React 19 + Vite 6 + Tailwind 4）
│   └── src/                    # Feature-Sliced: app / pages / shared
├── apps/
│   ├── demo/                   # 调试台（声明式接入 SDK）
│   ├── examples/               # 框架集成示例（vue3: 5174 / react: 5175）
│   └── knowledge/              # 知识库测试应用（独立 schema，测试工具调用链路）
├── dev.sh                      # 统一启动脚本（自动释放占用端口）
└── docs/
    ├── tech-design.md          # 技术方案
    └── migrations/             # 数据库迁移（robotik + knowledge schema）
```

## 端口规范

| 服务 | 端口 | 配置位置 |
|---|---|---|
| Supabase API | 54321 | infrastructure/supabase/config.toml |
| robotik-server | 8787 | robotik-server/.env `PORT=8787` |
| robotik-admin | 5173 | robotik-admin/vite.config.ts |
| apps/demo | 4000 | dev.sh |
| apps/examples/vue3 | 5174 | apps/examples/vue3/vite.config.ts |
| apps/examples/react | 5175 | apps/examples/react/vite.config.ts |

## 快速启动

```bash
# 启动 server + admin（端口被占用时自动释放）
./dev.sh all

# 单独启动某个服务
./dev.sh server     # 后端 :8787
./dev.sh admin      # 管理后台 :5173
./dev.sh demo       # 调试台 :4000
./dev.sh vue        # Vue3 示例 :5174
./dev.sh react      # React 示例 :5175

# 停止所有服务
./dev.sh stop

# 查看状态
./dev.sh status
```

前提：本地 Supabase 已启动（`supabase start`，API 在 127.0.0.1:54321）。

## 数据库

两个独立 schema:
- `robotik` — 核心基础设施：site_configs / conversations / messages / admins / usage_logs
- `knowledge` — 知识库测试应用：documents

迁移文件见 `docs/migrations/`。

## 管理后台

测试账号：`demo@webrobot.dev / demo123456`

| 页面 | 功能 |
|---|---|
| Dashboard | 应用数 / 会话数 / 消息数 / Token 用量 / 延迟 / 错误率 |
| 应用管理 | site_configs CRUD：机器人名称、欢迎语、工具白名单、启停 |
| 会话洞察 | 按应用过滤会话，展开消息时间线 + 工具调用详情 |
| 管理员 | 增删管理员 |

## SDK 接入

### 声明式（任意页面加一行）

```html
<script src="/robotik-sdk/dist/robot.js"
        data-app-id="default"
        data-server="http://localhost:8787"></script>
```

### 编程式

```ts
import { init } from '@robotik/sdk'

const robot = init({
  appId: 'my-app',
  server: 'https://api.myapp.com',
  suggestions: ['查订单', '退换货'],
})
```

## 工具体系

### 内置调试工具（所有应用可用）

| 工具 | 参数 | 用途 |
|---|---|---|
| `get_time` | — | 获取当前时间 |
| `echo` | `text` | 原样返回，测试链路 |
| `calculate` | `expression` | 简单数学运算 |

### 知识库工具（app_id='knowledge' 时加载）

| 工具 | 参数 | 用途 |
|---|---|---|
| `search_knowledge` | `query`, `category?` | 全文检索知识库 |
| `get_document_detail` | `document_id` | 获取完整文档 |
| `list_categories` | — | 列出所有分类 |

### 新应用接入工具

```bash
# 1. 新建工具模块
robotik-server/src/apps/myapp/myapp.tools.ts   # 定义 ToolDef[]
robotik-server/src/apps/myapp/myapp.module.ts   # OnModuleInit 注册

# 2. app.module.ts 加一行
import { MyappToolsModule } from './apps/myapp/myapp.module'
// AppModule.imports 加 MyappToolsModule
```

工具白名单通过 `site_configs.allowed_tools` 配置，Admin 后台可编辑。
