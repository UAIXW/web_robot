import type { ThemeConfig, ThemeMode, RobotPosition } from '../types'

export const DEFAULT_THEME: Required<ThemeConfig> = {
  primary: '#41e58f',
  mode: 'dark',
  position: 'bottom-right',
  panelWidth: 380,
  panelHeight: 540,
}

export function resolveMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  }
  return mode
}

export function applyTheme(root: ShadowRoot, theme: Required<ThemeConfig>): void {
  const host = root.host as HTMLElement
  const mode = resolveMode(theme.mode)

  host.style.setProperty('--wr-primary', theme.primary)
  host.style.setProperty('--wr-mode', mode)

  const panel = root.querySelector('.panel') as HTMLElement | null
  if (panel) {
    panel.style.width = `min(${theme.panelWidth}px, calc(100vw - 24px))`
    panel.style.height = `min(${theme.panelHeight}px, calc(100vh - 24px))`
  }

  const existing = root.querySelector('#wr-theme-override')
  if (existing) existing.remove()

  if (mode === 'light') {
    const el = document.createElement('style')
    el.id = 'wr-theme-override'
    el.textContent = `
      .panel { background: #ffffff; border-color: #e2e8f0; color: #1e293b; }
      .panel-head { background: #f8fafc; border-color: #e2e8f0; }
      .panel-head .sub { color: #64748b; }
      .panel-head .close { color: #64748b; }
      .panel-head .close:hover { background: #f1f5f9; color: #1e293b; }
      .messages::-webkit-scrollbar-thumb { background: #cbd5e1; }
      .msg.bot { background: #f1f5f9; border-color: #e2e8f0; }
      .msg.tool { color: #64748b; border-color: #e2e8f0; }
      .composer { background: #f8fafc; border-color: #e2e8f0; }
      .composer input { background: #ffffff; color: #1e293b; border-color: #cbd5e1; }
      .hintbar { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; }
    `
    root.appendChild(el)
  }
}

export function getDefaultPosition(position: RobotPosition): { x: number; y: number } {
  const w = window.innerWidth
  const h = window.innerHeight
  const size = 60
  const margin = 24

  switch (position) {
    case 'bottom-left':
      return { x: margin, y: h - size - margin }
    case 'top-right':
      return { x: w - size - margin, y: margin }
    case 'top-left':
      return { x: margin, y: margin }
    default:
      return { x: w - size - margin, y: h - size - 100 }
  }
}

export function mergeTheme(
  base: Required<ThemeConfig>,
  overrides?: ThemeConfig,
): Required<ThemeConfig> {
  if (!overrides) return base
  return { ...base, ...overrides }
}
