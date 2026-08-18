import { init } from './core/robot'

if (typeof document !== 'undefined') {
  const script = document.currentScript as HTMLElement | null
  if (script && script.dataset.appId) {
    init()
  }
}

export { init }
export type {
  InitConfig,
  RobotConfig,
  ThemeConfig,
  WebRobotAPI,
  EventMap,
  EventHandler,
  AuthAdapter,
  Session,
  MessageRole,
  MessageStore,
  StoredMessage,
  ThemeMode,
  RobotPosition,
  LocaleConfig,
  RenderMessage,
} from './types'
