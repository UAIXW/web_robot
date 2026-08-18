import type { InitConfig, RobotConfig } from '../types'

export const SESSION_KEY = 'web_robot.session'
export const CLICK_SLOP = 5
export const DEFAULT_GREETING = '你好！我是你的 AI 助手 🤖\n可以把我拖到任意位置，点击收起。'

export function posKey(appId: string): string {
  return `web_robot.robot.pos.${appId}`
}

export function convKey(appId: string): string {
  return `web_robot.robot.conv.${appId}`
}

export function parseDataset(el: HTMLElement | null): Partial<InitConfig> {
  if (!el) return {}
  const d = el.dataset
  return {
    appId: d.appId || 'default',
    server: d.server || undefined,
    name: d.name || undefined,
    greeting: d.greeting || undefined,
    theme: d.themePrimary
      ? {
          primary: d.themePrimary,
          mode:
            d.themeMode === 'dark' || d.themeMode === 'light' || d.themeMode === 'auto'
              ? d.themeMode
              : undefined,
        }
      : undefined,
    suggestions: d.suggestions ? d.suggestions.split(',').map((s) => s.trim()) : undefined,
  }
}

export function buildConfig(init: InitConfig): RobotConfig {
  return {
    appId: init.appId,
    server: init.server || '',
    name: init.name || '小助手',
    headers: init.headers,
    fetchImpl: init.fetchImpl,
    timeout: init.timeout,
  }
}
