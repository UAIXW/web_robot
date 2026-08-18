import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { init, type InitConfig, type WebRobotAPI } from '@robotik/sdk'

export interface WebRobotProps {
  appId: string
  server?: string
  name?: string
  greeting?: string
  suggestions?: string[]
  /** Local reply when backend unavailable (business logic injected by host) */
  fallback?: (text: string) => Promise<string>
  /** Tool name → display label */
  toolLabels?: Record<string, string>
  primaryColor?: string
  themeMode?: 'dark' | 'light' | 'auto'
  onOpen?: () => void
  onClose?: () => void
  onMessageSend?: (payload: { text: string }) => void
  onMessageReceived?: (payload: { text: string; role: string }) => void
  onToolCall?: (payload: { name: string; args?: Record<string, unknown> }) => void
  onToolResult?: (payload: { name: string; ok: boolean; summary?: string }) => void
  onError?: (payload: { error: Error }) => void
}

export interface WebRobotHandle {
  open: () => void
  close: () => void
  send: (text: string) => Promise<void>
  clearHistory: () => Promise<void>
  destroy: () => void
}

const WebRobot = forwardRef<WebRobotHandle, WebRobotProps>(function WebRobot(props, ref) {
  const apiRef = useRef<WebRobotAPI | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const p = propsRef.current
    const cfg: InitConfig = {
      appId: p.appId,
      server: p.server,
      name: p.name,
      greeting: p.greeting,
      suggestions: p.suggestions,
      fallback: p.fallback,
      toolLabels: p.toolLabels,
      theme: { primary: p.primaryColor ?? '#41e58f', mode: p.themeMode ?? 'dark' },
      on: {
        open: () => p.onOpen?.(),
        close: () => p.onClose?.(),
        'message:send': (e) => p.onMessageSend?.(e),
        'message:received': (e) => p.onMessageReceived?.(e),
        'tool:call': (e) => p.onToolCall?.(e),
        'tool:result': (e) => p.onToolResult?.(e),
        error: (e) => p.onError?.(e),
      },
    }
    apiRef.current = init(cfg) || null
    return () => {
      apiRef.current?.destroy()
      apiRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    open: () => apiRef.current?.open(),
    close: () => apiRef.current?.close(),
    send: async (text: string) => {
      await apiRef.current?.send(text)
    },
    clearHistory: async () => {
      await apiRef.current?.clearHistory()
    },
    destroy: () => apiRef.current?.destroy(),
  }))

  return null
})

export default WebRobot
