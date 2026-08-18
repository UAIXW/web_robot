import type { MessageRole, RenderMessage } from '../types'
import type { UIElements } from './template'
import { esc } from './esc'

export function addMsg(
  el: UIElements,
  role: MessageRole,
  text: string,
  render?: RenderMessage,
): HTMLElement {
  const div = document.createElement('div')
  div.className = `msg ${role}`
  if (render) {
    const out = render(text, role)
    if (out instanceof Node) div.appendChild(out)
    else div.innerHTML = out
  } else {
    div.innerHTML = esc(text)
  }
  el.messages.appendChild(div)
  el.messages.scrollTop = el.messages.scrollHeight
  return div
}

/** 内置轻量安全 Markdown：先转义 HTML，再对转义后的文本做受控标记替换，XSS 面可控 */
export function renderMarkdown(src: string): string {
  let text = esc(src)
  // 代码块
  text = text.replace(/```([\s\S]*?)```/g, (_m, code: string) => `<pre><code>${code}</code></pre>`)
  // 行内代码
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  // 粗体
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  // 链接（仅 http/https，防 javascript: 注入）
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  return text
}

export function typing(el: UIElements): { remove: () => void } {
  const div = document.createElement('div')
  div.className = 'msg bot typing'
  div.innerHTML = '<span></span><span></span><span></span>'
  el.messages.appendChild(div)
  el.messages.scrollTop = el.messages.scrollHeight
  return {
    remove: () => div.remove(),
  }
}
