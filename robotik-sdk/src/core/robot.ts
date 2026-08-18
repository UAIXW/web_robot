import type {
  InitConfig,
  RobotConfig,
  ThemeConfig,
  WebRobotAPI,
  EventMap,
  EventHandler,
  AuthAdapter,
  MessageRole,
  MessageStore,
  LocaleConfig,
  RenderMessage,
} from '../types'
import { buildConfig, parseDataset, convKey, DEFAULT_GREETING } from './config'
import { createDefaultAuth } from '../auth'
import {
  createUI,
  setupDrag,
  alignPanel,
  addMsg,
  typing,
  renderMarkdown,
  loadPos,
  place,
  applyTheme,
  mergeTheme,
  getDefaultPosition,
  DEFAULT_THEME,
  type UIElements,
} from '../ui'
import { chatRemote } from '../transport'
import { createIdbStore } from '../storage'
import { EventBus } from './events'

const HISTORY_LIMIT = 50

function renderSuggestions(
  el: UIElements,
  suggestions: string[],
  send: (text: string) => void,
): void {
  const container = document.createElement('div')
  container.style.cssText = 'display:flex;gap:6px;padding:4px 16px 8px;flex-wrap:wrap;'
  for (const s of suggestions) {
    const btn = document.createElement('button')
    btn.textContent = s
    btn.style.cssText =
      'font:inherit;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid #2b3a4f;background:transparent;color:#76879b;cursor:pointer;'
    btn.addEventListener('click', () => send(s))
    container.appendChild(btn)
  }
  el.messages.insertBefore(container, el.messages.firstChild)
}

export function init(customCfg?: Partial<InitConfig>): WebRobotAPI | undefined {
  const scriptEl = document.currentScript as HTMLElement | null
  const ds = parseDataset(scriptEl)
  const raw: InitConfig = { ...ds, ...customCfg } as InitConfig

  if (!raw.appId) {
    console.warn('[web-robot] 缺少 appId 配置，机器人未启动')
    return
  }

  const cfg: RobotConfig = buildConfig(raw)
  const auth: AuthAdapter = raw.auth || createDefaultAuth()
  const store: MessageStore = raw.store || createIdbStore()
  const events = new EventBus()
  const theme = mergeTheme(DEFAULT_THEME, raw.theme)
  const greeting = raw.greeting || DEFAULT_GREETING
  const toolLabels = raw.toolLabels || {}
  const locale: LocaleConfig = raw.locale || {}

  // 消息渲染器：优先宿主 renderMessage，其次内置 markdown，默认纯文本转义
  const render: RenderMessage | undefined = raw.renderMessage
    ? raw.renderMessage
    : raw.markdown
      ? renderMarkdown
      : undefined

  const el: UIElements = createUI(cfg, {
    icon: raw.icon,
    placeholder: locale.placeholder,
    send: locale.send,
    hint: locale.hint,
  })
  applyTheme(el.root, theme)

  const instanceIndex = document.querySelectorAll('.web-robot-host').length - 1
  const savedPos = loadPos(cfg.appId)
  const defaultPos = getDefaultPosition(theme.position)
  if (!savedPos && instanceIndex > 0) {
    defaultPos.x = Math.max(24, defaultPos.x - instanceIndex * 84)
  }
  place(el, savedPos ?? defaultPos)

  let convId: string | null = null
  let panelOpen = false
  let busy = false
  let destroyed = false
  let lastUserId: string | null | undefined
  let historyReq = 0

  const cleanupFns: Array<() => void> = []

  const currentUserId = (): string | null => auth.getUser?.()?.id ?? null

  const persistLocal = (role: MessageRole, content: string, toolName?: string): void => {
    void store.append({
      appId: cfg.appId,
      userId: currentUserId(),
      role,
      content,
      toolName,
      createdAt: Date.now(),
    })
    if (raw.persistMessage) {
      void raw.persistMessage(role, content, toolName).catch((e) => {
        console.warn('[web-robot] persistMessage hook failed:', e)
      })
    }
  }

  const setConvId = (id: string): void => {
    convId = id
    localStorage.setItem(convKey(cfg.appId), id)
  }

  const onToolCall = (name: string, args?: Record<string, unknown>): void => {
    const label = toolLabels[name] || name
    events.emit('tool:call', { name: label, args })
  }

  const onToolResult = (name: string, ok: boolean, summary?: string): void => {
    const label = toolLabels[name] || name
    events.emit('tool:result', { name: label, ok, summary })
    persistLocal('tool', `${label} ${ok ? '✓' : '✗'}${summary ? ' ' + summary : ''}`, name)
  }

  const restoreConv = (): void => {
    if (!auth.getToken()) {
      convId = null
      return
    }
    convId = localStorage.getItem(convKey(cfg.appId)) || null
  }

  const loadHistory = async (): Promise<void> => {
    const uid = currentUserId()
    if (uid === lastUserId) return
    lastUserId = uid
    const seq = ++historyReq
    const history = await store.recent(cfg.appId, uid, HISTORY_LIMIT)
    if (destroyed || seq !== historyReq) return
    el.messages.querySelectorAll('.msg').forEach((m) => m.remove())
    if (history.length) {
      for (const m of history) {
        addMsg(el, m.role === 'assistant' ? 'bot' : m.role, m.content, render)
      }
      el.messages.scrollTop = el.messages.scrollHeight
    } else {
      addMsg(el, 'bot', greeting, render)
    }
  }

  const togglePanel = (force?: boolean): void => {
    panelOpen = force !== undefined ? force : !panelOpen
    if (panelOpen) {
      alignPanel(el)
      el.panel.classList.add('open')
      el.input.focus()
      events.emit('open')
    } else {
      el.panel.classList.remove('open')
      events.emit('close')
    }
    el.dot.classList.remove('show')
  }

  el.close.addEventListener('click', () => togglePanel(false))

  const cleanupDrag = setupDrag(el, cfg, (moved) => {
    if (!moved) {
      togglePanel()
    } else {
      alignPanel(el)
    }
  })
  cleanupFns.push(cleanupDrag)

  const send = async (text?: string): Promise<void> => {
    const content = (text ?? el.input.value).trim()
    if (!content || busy || destroyed) return
    if (raw.beforeSend) {
      const ok = await raw.beforeSend(content)
      if (ok === false) return
    }
    busy = true
    el.send.disabled = true
    el.input.value = ''
    addMsg(el, 'user', content, render)
    persistLocal('user', content)
    events.emit('message:send', { text: content })

    try {
      if (cfg.server && auth.getToken()) {
        try {
          const answer = await chatRemote(
            cfg,
            auth,
            el,
            convId,
            setConvId,
            content,
            onToolCall,
            onToolResult,
            { render, locale },
          )
          if (destroyed) return
          persistLocal('assistant', answer)
          events.emit('message:received', { text: answer, role: 'bot' })
          return
        } catch (e) {
          console.warn('[web-robot] Remote chat failed, trying fallback:', e)
        }
      }

      if (raw.fallback) {
        const tp = typing(el)
        try {
          const reply = await raw.fallback(content)
          tp.remove()
          if (destroyed) return
          addMsg(el, 'bot', reply, render)
          persistLocal('assistant', reply)
          events.emit('message:received', { text: reply, role: 'bot' })
        } catch (e) {
          tp.remove()
          if (destroyed) return
          const msg = `${locale.errorPrefix ?? '出错了：'}${(e as Error).message}`
          addMsg(el, 'bot', msg, render)
          persistLocal('assistant', msg)
          events.emit('error', { error: e as Error })
        }
      } else if (!cfg.server) {
        addMsg(
          el,
          'bot',
          locale.pleaseConfigureServer ?? '请配置后端服务地址（data-server 或 server 参数）以启用 AI 对话。',
          render,
        )
      } else if (!auth.getToken()) {
        addMsg(el, 'bot', locale.pleaseLogin ?? '请先登录后再对话。', render)
      }
    } finally {
      busy = false
      el.send.disabled = false
      if (!destroyed) el.input.focus()
    }
  }

  el.send.addEventListener('click', () => send())
  el.input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') send()
  })

  const refreshStatus = (): void => {
    const token = auth.getToken()
    const user = auth.getUser?.()
    if (token && user) {
      const mode = cfg.server ? (locale.aiMode ?? 'AI 模式') : (locale.localMode ?? '本地模式')
      el.status.textContent = `${mode} · ${user.email}`
    } else {
      el.status.textContent = locale.notLoggedIn ?? '未登录'
    }
    if (!token) {
      convId = null
      localStorage.removeItem(convKey(cfg.appId))
    } else {
      restoreConv()
    }
    events.emit('session:change', {
      session: user && token ? { accessToken: token, user } : null,
    })
    void loadHistory()
  }

  const unwatchSession = auth.onSessionChange?.(refreshStatus)
  if (unwatchSession) cleanupFns.push(unwatchSession)

  refreshStatus()

  const dotTimer = setTimeout(() => {
    if (!destroyed) el.dot.classList.add('show')
  }, 1200)

  if (raw.on) {
    for (const [event, handler] of Object.entries(raw.on)) {
      if (handler) {
        events.on(event as keyof EventMap, handler as EventHandler<keyof EventMap>)
      }
    }
  }

  if (raw.suggestions && raw.suggestions.length) {
    renderSuggestions(el, raw.suggestions, send)
  }

  if (raw.autoOpen) {
    togglePanel(true)
  }

  const api: WebRobotAPI = {
    open: () => togglePanel(true),
    close: () => togglePanel(false),
    send,
    on: (event, handler) => events.on(event, handler),
    off: (event, handler) => events.off(event, handler),
    setTheme: (overrides: Partial<ThemeConfig>) => {
      Object.assign(theme, overrides)
      applyTheme(el.root, theme)
    },
    clearHistory: async () => {
      await store.clear(cfg.appId, currentUserId())
      convId = null
      localStorage.removeItem(convKey(cfg.appId))
      el.messages.querySelectorAll('.msg').forEach((m) => m.remove())
      addMsg(el, 'bot', greeting, render)
    },
    destroy: () => {
      destroyed = true
      clearTimeout(dotTimer)
      events.clear()
      cleanupFns.forEach((fn) => fn())
      cleanupFns.length = 0
      el.host.remove()
    },
    config: cfg,
  }

  if (!window.WebRobot) window.WebRobot = api
  return api
}
