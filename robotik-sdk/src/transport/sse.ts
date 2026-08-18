import type { RobotConfig, AuthAdapter, LocaleConfig, RenderMessage } from '../types'
import type { UIElements } from '../ui'
import { addMsg, typing } from '../ui'

export interface ChatRemoteOptions {
  render?: RenderMessage
  locale?: LocaleConfig
}

export async function chatRemote(
  cfg: RobotConfig,
  auth: AuthAdapter,
  el: UIElements,
  convId: string | null,
  setConvId: (id: string) => void,
  text: string,
  onToolCall?: (name: string, args?: Record<string, unknown>) => void,
  onToolResult?: (name: string, ok: boolean, summary?: string) => void,
  options: ChatRemoteOptions = {},
): Promise<string> {
  const token = auth.getToken()
  if (!token) throw new Error('no session')

  const doFetch = cfg.fetchImpl ?? fetch
  const disconnected = options.locale?.disconnected ?? '[连接中断]'
  const noContent = options.locale?.noContent ?? '（后端没有返回内容）'

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), cfg.timeout ?? 30000)

  let res: Response
  try {
    res = await doFetch(cfg.server + '/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...cfg.headers,
      },
      body: JSON.stringify({
        app_id: cfg.appId,
        conversation_id: convId || undefined,
        message: text,
      }),
      signal: ac.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const body = res.body
  if (!body) throw new Error('Response body is null')

  const tp = typing(el)
  let msgEl: HTMLElement | null = null
  let toolEl: HTMLElement | null = null
  let answer = ''

  const handleEvent = (event: string, data: Record<string, unknown>) => {
    if (event === 'delta') {
      const chunk = (data.text as string) || ''
      answer += chunk
      if (!msgEl) {
        tp.remove()
        msgEl = addMsg(el, 'bot', '')
      }
      msgEl.textContent += chunk
      el.messages.scrollTop = el.messages.scrollHeight
    } else if (event === 'tool_call') {
      const name = data.name as string
      toolEl = addMsg(el, 'tool', '⚙ ' + name + '…')
      onToolCall?.(name, data.args as Record<string, unknown>)
    } else if (event === 'tool_result') {
      const name = data.name as string
      if (toolEl) toolEl.textContent = '⚙ ' + name + ' ✓'
      toolEl = null
      onToolResult?.(name, data.ok as boolean, data.summary as string)
    } else if (event === 'done') {
      const id = data.conversation_id as string | undefined
      if (id) setConvId(id)
    } else if (event === 'error') {
      throw new Error((data.message as string) || '后端处理失败')
    }
  }

  try {
    const reader = body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let parsing = true
    while (parsing) {
      const { done, value } = await reader.read()
      if (done) {
        parsing = false
        break
      }
      buf += dec.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        let ev = 'message'
        let dataStr = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim()
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
        }
        let data: Record<string, unknown> = {}
        if (dataStr) {
          try {
            data = JSON.parse(dataStr)
          } catch (e) {
            console.warn('[web-robot] SSE data parse error:', e)
          }
        }
        handleEvent(ev, data)
      }
    }
  } catch (e) {
    if (answer) {
      if (msgEl) msgEl.textContent += '\n' + disconnected
      return answer + '\n' + disconnected
    }
    throw e
  } finally {
    tp.remove()
  }

  if (!answer) {
    addMsg(el, 'bot', noContent)
    return answer
  }

  // 流式结束后，若提供自定义渲染器则重渲染最终答案（Markdown / 富文本等）
  if (msgEl && options.render) {
    const out = options.render(answer, 'bot')
    const target = msgEl as HTMLElement
    target.innerHTML = ''
    if (out instanceof Node) target.appendChild(out)
    else target.innerHTML = out
  }
  return answer
}
