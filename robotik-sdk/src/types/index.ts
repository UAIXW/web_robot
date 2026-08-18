/* ========== Runtime internal types ========== */

export interface RobotConfig {
  appId: string
  server: string
  name: string
  /** 附加请求头 */
  headers?: Record<string, string>
  /** 自定义 fetch 实现（埋点/重试/超时等） */
  fetchImpl?: typeof fetch
  /** 请求超时（毫秒），默认 30000 */
  timeout?: number
}

export interface Session {
  accessToken: string
  user: {
    id: string
    email: string
  }
}

export type MessageRole = 'user' | 'bot' | 'tool' | 'assistant'

export type ThemeMode = 'dark' | 'light' | 'auto'

export type RobotPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

/* ========== Adapter interfaces ========== */

export interface AuthAdapter {
  getToken: () => string | null
  getUser?: () => { id: string; email: string } | null
  onSessionChange?: (cb: () => void) => void
}

/* ========== Theme configuration ========== */

export interface ThemeConfig {
  primary?: string
  mode?: ThemeMode
  position?: RobotPosition
  panelWidth?: number
  panelHeight?: number
}

/* ========== Event system ========== */

export interface EventMap {
  open: undefined
  close: undefined
  'message:send': { text: string }
  'message:received': { text: string; role: MessageRole }
  'tool:call': { name: string; args?: Record<string, unknown> }
  'tool:result': { name: string; ok: boolean; summary?: string }
  'session:change': { session: Session | null }
  error: { error: Error }
}

export type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>

/* ========== Customization ========== */

/** 自定义消息渲染：返回 HTML 字符串或 DOM 节点 */
export type RenderMessage = (text: string, role: MessageRole) => string | Node

/** 内置文案（默认中文） */
export interface LocaleConfig {
  /** 状态栏：未登录 */
  notLoggedIn?: string
  /** 状态栏：AI 模式前缀（拼在邮箱前） */
  aiMode?: string
  /** 状态栏：本地模式前缀 */
  localMode?: string
  /** 输入框占位符 */
  placeholder?: string
  /** 发送按钮文案 */
  send?: string
  /** 底部提示条 */
  hint?: string
  /** 未登录时点击发送的提示 */
  pleaseLogin?: string
  /** 未配置后端时的提示 */
  pleaseConfigureServer?: string
  /** 错误信息前缀 */
  errorPrefix?: string
  /** 后端没有返回内容 */
  noContent?: string
  /** 连接中断标记 */
  disconnected?: string
}

/* ========== Init configuration ========== */

export interface InitConfig {
  appId: string
  server?: string
  /** Auth adapter, defaults to localStorage */
  auth?: AuthAdapter
  /** Theme configuration */
  theme?: ThemeConfig
  /** Robot display name */
  name?: string
  /** Welcome message */
  greeting?: string
  /** Quick suggestion chips */
  suggestions?: string[]
  /** Event callbacks */
  on?: Partial<{ [K in keyof EventMap]: EventHandler<K> }>
  /** Local reply callback when backend is unavailable or not configured (business logic injected by host) */
  fallback?: (text: string) => Promise<string>
  /** Tool name → display label mapping for tool events */
  toolLabels?: Record<string, string>
  /** Custom local message store, defaults to IndexedDB (idb) */
  store?: MessageStore
  /** Custom message persistence hook (e.g. sync to cloud) */
  persistMessage?: (role: MessageRole, content: string, toolName?: string) => Promise<void>
  /** 内置文案国际化 */
  locale?: LocaleConfig
  /** 自定义消息渲染（Markdown / 富文本 / 代码高亮），返回 HTML 字符串或 DOM 节点 */
  renderMessage?: RenderMessage
  /** 内置轻量安全 Markdown 渲染（粗体/行内代码/代码块/链接），默认 false 保持纯文本转义 */
  markdown?: boolean
  /** 机器人头像：SVG 字符串或图片 URL（http/https/data:） */
  icon?: string
  /** 附加请求头（合并进 SSE 请求） */
  headers?: Record<string, string>
  /** 自定义 fetch 实现 */
  fetchImpl?: typeof fetch
  /** 发送前钩子：返回 false 可取消发送 */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- void 表示「可不返回值」，是可选回调的合法返回类型
  beforeSend?: (text: string) => boolean | void | Promise<boolean | void>
  /** 初始化后自动打开面板 */
  autoOpen?: boolean
  /** 请求超时（毫秒） */
  timeout?: number
}

/* ========== Local storage ========== */

export interface StoredMessage {
  id?: number
  appId: string
  userId: string | null
  role: MessageRole
  content: string
  toolName?: string
  createdAt: number
}

export interface MessageStore {
  append(msg: Omit<StoredMessage, 'id'>): Promise<void>
  recent(appId: string, userId: string | null, limit: number): Promise<StoredMessage[]>
  clear(appId: string, userId: string | null): Promise<void>
  export(appId: string, userId: string | null): Promise<StoredMessage[]>
}

/* ========== Public API ========== */

export interface WebRobotAPI {
  open: () => void
  close: () => void
  send: (text: string) => Promise<void>
  on: <K extends keyof EventMap>(event: K, handler: EventHandler<K>) => void
  off: <K extends keyof EventMap>(event: K, handler: EventHandler<K>) => void
  setTheme: (theme: Partial<ThemeConfig>) => void
  clearHistory: () => Promise<void>
  destroy: () => void
  config: RobotConfig
}

declare global {
  interface Window {
    WebRobot?: WebRobotAPI
  }
}
