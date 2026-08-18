import { useEffect, useRef, useState, useCallback } from 'react'
import { init, type WebRobotAPI, type InitConfig, type Session } from '@robotik/sdk'

export interface UseWebRobotReturn {
  api: WebRobotAPI | null
  isOpen: boolean
  session: Session | null
  lastError: string | null
  open: () => void
  close: () => void
  send: (text: string) => Promise<void>
  clearHistory: () => Promise<void>
}

export function useWebRobot(config: InitConfig): UseWebRobotReturn {
  const apiRef = useRef<WebRobotAPI | null>(null)
  const [api, setApi] = useState<WebRobotAPI | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const instance = init(configRef.current) || null
    apiRef.current = instance
    setApi(instance)

    if (instance) {
      instance.on('open', () => setIsOpen(true))
      instance.on('close', () => setIsOpen(false))
      instance.on('session:change', ({ session: s }) => setSession(s))
      instance.on('error', ({ error }) => setLastError(error.message))
    }

    return () => {
      instance?.destroy()
      apiRef.current = null
      setApi(null)
    }
  }, [])

  const open = useCallback(() => apiRef.current?.open(), [])
  const close = useCallback(() => apiRef.current?.close(), [])
  const send = useCallback(async (text: string) => {
    await apiRef.current?.send(text)
  }, [])
  const clearHistory = useCallback(async () => {
    await apiRef.current?.clearHistory()
  }, [])

  return { api, isOpen, session, lastError, open, close, send, clearHistory }
}
