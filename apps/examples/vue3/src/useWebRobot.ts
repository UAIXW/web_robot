import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { init, type WebRobotAPI, type InitConfig, type EventMap, type Session } from '@robotik/sdk'

export interface UseWebRobotReturn {
  api: Ref<WebRobotAPI | null>
  isOpen: Ref<boolean>
  session: Ref<Session | null>
  lastError: Ref<string | null>
  open: () => void
  close: () => void
  send: (text: string) => Promise<void>
  setTheme: (theme: NonNullable<InitConfig['theme']>) => void
}

export function useWebRobot(config: InitConfig): UseWebRobotReturn {
  const api = ref<WebRobotAPI | null>(null)
  const isOpen = ref(false)
  const session = ref<Session | null>(null)
  const lastError = ref<string | null>(null)

  onMounted(() => {
    api.value = init(config) || null

    if (api.value) {
      api.value.on('open', () => {
        isOpen.value = true
      })
      api.value.on('close', () => {
        isOpen.value = false
      })
      api.value.on('session:change', ({ session: s }) => {
        session.value = s
      })
      api.value.on('error', ({ error }) => {
        lastError.value = error.message
      })
    }
  })

  onUnmounted(() => {
    api.value?.destroy()
    api.value = null
  })

  function open(): void {
    api.value?.open()
  }

  function close(): void {
    api.value?.close()
  }

  async function send(text: string): Promise<void> {
    await api.value?.send(text)
  }

  function setTheme(theme: NonNullable<InitConfig['theme']>): void {
    api.value?.setTheme(theme)
  }

  return {
    api,
    isOpen,
    session,
    lastError,
    open,
    close,
    send,
    setTheme,
  }
}
