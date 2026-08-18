import type { RobotConfig } from '../types'
import { esc } from './esc'

export interface UICreateOptions {
  /** 机器人头像：SVG 字符串或图片 URL */
  icon?: string
  /** 输入框占位符 */
  placeholder?: string
  /** 发送按钮文案 */
  send?: string
  /** 底部提示条 */
  hint?: string
}

const DEFAULT_ROBOT_SVG = `<svg viewBox="0 0 60 60" fill="none">
    <defs>
      <linearGradient id="wr-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1dbf77"/><stop offset="1" stop-color="#15995f"/>
      </linearGradient>
    </defs>
    <circle cx="30" cy="30" r="28" fill="url(#wr-bg)"/>
    <rect x="15" y="20" width="30" height="24" rx="8" fill="#0d2b1d"/>
    <g class="eye">
      <circle cx="24" cy="31" r="3.2" fill="#41e58f"/>
      <circle cx="36" cy="31" r="3.2" fill="#41e58f"/>
    </g>
    <path d="M24 38.5h12" stroke="#41e58f" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M30 20v-6" stroke="#0d2b1d" stroke-width="3" stroke-linecap="round"/>
    <circle cx="30" cy="11" r="3.4" fill="#ffb454"/>
    <path d="M12 27l-4-3M48 27l4-3" stroke="#0d2b1d" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`

function renderIcon(icon?: string): string {
  if (!icon) return DEFAULT_ROBOT_SVG
  const t = icon.trim()
  if (/^https?:\/\//i.test(t) || /^data:image\//i.test(t)) {
    return `<img class="robot-img" src="${esc(t)}" alt="" />`
  }
  // 视为宿主提供的 SVG 字符串
  return t
}

export function buildShadowHTML(cfg: RobotConfig, opts: UICreateOptions = {}): string {
  return `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .robot {
    position: fixed;
    width: 60px; height: 60px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    filter: drop-shadow(0 6px 16px rgba(0,0,0,.35));
    transition: transform .2s cubic-bezier(.34,1.56,.64,1);
    will-change: transform;
  }
  .robot:hover { transform: scale(1.08); }
  .robot.dragging { cursor: grabbing; transition: none; transform: scale(1.12); }
  .robot svg { width: 100%; height: 100%; display: block; pointer-events: none; }
  .robot .robot-img { width: 100%; height: 100%; display: block; object-fit: cover; pointer-events: none; border-radius: 50%; }
  .robot .eye { transform-origin: center; animation: blink 4s infinite; }
  @keyframes blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
  .robot .dot {
    position: absolute; top: 2px; right: 2px; width: 12px; height: 12px;
    border-radius: 50%; background: var(--wr-primary, #41e58f); border: 2px solid #0a0e14;
    opacity: 0; transform: scale(0); transition: all .25s;
  }
  .robot .dot.show { opacity: 1; transform: scale(1); }

  .panel {
    position: fixed;
    width: min(380px, calc(100vw - 24px));
    height: min(540px, calc(100vh - 24px));
    background: #10151e;
    border: 1px solid #2b3a4f;
    border-radius: 14px;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,.5);
    font: 400 14px/1.6 "PingFang SC", "JetBrains Mono", ui-monospace, system-ui, sans-serif;
    color: #d9e2ec;
    opacity: 0; transform: translateY(12px) scale(.97); pointer-events: none;
    transition: opacity .22s ease, transform .22s cubic-bezier(.34,1.4,.64,1);
  }
  .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .panel-head {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    background: #141b26; border-bottom: 1px solid #1e2836;
    cursor: grab;
  }
  .panel-head .avatar { width: 34px; height: 34px; border-radius: 10px; background: rgba(65,229,143,.12); display: grid; place-items: center; }
  .panel-head .avatar svg { width: 22px; height: 22px; }
  .panel-head .title { font-weight: 600; font-size: 14px; }
  .panel-head .sub { font-size: 11px; color: #76879b; }
  .panel-head .close {
    margin-left: auto; cursor: pointer; color: #76879b;
    width: 28px; height: 28px; border-radius: 8px;
    display: grid; place-items: center; font-size: 16px;
  }
  .panel-head .close:hover { background: #1e2836; color: #d9e2ec; }

  .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .messages::-webkit-scrollbar { width: 6px; }
  .messages::-webkit-scrollbar-thumb { background: #2b3a4f; border-radius: 3px; }
  .msg {
    max-width: 82%; padding: 9px 12px; border-radius: 12px;
    font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word;
    animation: pop .25s cubic-bezier(.34,1.4,.64,1);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
  .msg.bot { align-self: flex-start; background: #1a2230; border: 1px solid #243044; border-top-left-radius: 4px; }
  .msg.user { align-self: flex-end; background: rgba(65,229,143,.14); border: 1px solid rgba(65,229,143,.35); border-top-right-radius: 4px; }
  .msg.tool { align-self: flex-start; color: #76879b; font-size: 12px; border: 1px dashed #2b3a4f; background: transparent; }
  .msg code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; background: rgba(0,0,0,.32); padding: 1px 5px; border-radius: 4px; }
  .msg pre { background: rgba(0,0,0,.32); padding: 8px 10px; border-radius: 8px; overflow-x: auto; margin: 6px 0; }
  .msg pre code { background: transparent; padding: 0; }
  .msg a { color: var(--wr-primary, #41e58f); text-decoration: underline; }
  .msg strong { font-weight: 600; }
  .msg.typing span {
    display: inline-block; width: 6px; height: 6px; margin-right: 3px;
    background: #76879b; border-radius: 50%;
    animation: typing 1.2s infinite;
  }
  .msg.typing span:nth-child(2) { animation-delay: .15s; }
  .msg.typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes typing { 30% { transform: translateY(-4px); background: var(--wr-primary, #41e58f); } }

  .composer {
    display: flex; gap: 8px; padding: 12px;
    border-top: 1px solid #1e2836; background: #141b26;
  }
  .composer input {
    flex: 1; padding: 10px 12px; font: inherit; font-size: 13px;
    background: #0a0e14; color: #d9e2ec;
    border: 1px solid #2b3a4f; border-radius: 8px; outline: none;
  }
  .composer input:focus { border-color: var(--wr-primary, #41e58f); }
  .composer button {
    padding: 0 16px; font: inherit; font-size: 13px; cursor: pointer;
    background: rgba(65,229,143,.14); color: var(--wr-primary, #41e58f);
    border: 1px solid rgba(65,229,143,.4); border-radius: 8px;
  }
  .composer button:hover { background: rgba(65,229,143,.24); }
  .composer button:disabled { opacity: .4; cursor: wait; }

  .hintbar { padding: 6px 16px; font-size: 11px; color: #4a586a; background: #141b26; border-top: 1px solid #1e2836; }
</style>

<div class="robot" part="robot">
  ${renderIcon(opts.icon)}
  <span class="dot"></span>
</div>

<div class="panel">
  <div class="panel-head">
    <div class="avatar">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="7" width="16" height="13" rx="3" stroke="#41e58f" stroke-width="1.6"/>
        <circle cx="9.5" cy="13.5" r="1.6" fill="#41e58f"/>
        <circle cx="14.5" cy="13.5" r="1.6" fill="#41e58f"/>
        <path d="M12 7V4M11 3h2" stroke="#41e58f" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </div>
    <div>
      <div class="title">${esc(cfg.name)}</div>
      <div class="sub" id="wr-status">未登录</div>
    </div>
    <div class="close" title="收起">✕</div>
  </div>
  <div class="messages"></div>
  <div class="composer">
    <input type="text" placeholder="${esc(opts.placeholder ?? '输入消息...')}" maxlength="200">
    <button>${esc(opts.send ?? '发送')}</button>
  </div>
  <div class="hintbar">${esc(opts.hint ?? '拖动我调整位置 · 点击收起面板')}</div>
</div>`
}

export interface UIElements {
  host: HTMLDivElement
  root: ShadowRoot
  robot: HTMLElement
  dot: HTMLElement
  panel: HTMLElement
  close: HTMLElement
  title: HTMLElement
  messages: HTMLElement
  input: HTMLInputElement
  send: HTMLButtonElement
  status: HTMLElement
}

export function createUI(cfg: RobotConfig, opts: UICreateOptions = {}): UIElements {
  const host = document.createElement('div')
  host.className = 'web-robot-host'
  host.dataset.appId = cfg.appId
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = buildShadowHTML(cfg, opts)
  document.body.appendChild(host)

  const qs = <T extends Element>(sel: string): T => {
    const el = root.querySelector(sel)
    if (!el) throw new Error(`[web-robot] Shadow DOM element not found: ${sel}`)
    return el as T
  }

  return {
    host,
    root,
    robot: qs('.robot'),
    dot: qs('.dot'),
    panel: qs('.panel'),
    close: qs('.close'),
    title: qs('.panel-head .title'),
    messages: qs('.messages'),
    input: qs('.composer input'),
    send: qs('.composer button'),
    status: qs('#wr-status'),
  }
}
