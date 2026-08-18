import type { Session, AuthAdapter } from '../types'
import { SESSION_KEY } from '../core/config'

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      accessToken: parsed.access_token as string,
      user: parsed.user as { id: string; email: string },
    }
  } catch {
    return null
  }
}

export function watchSession(cb: () => void): () => void {
  const handler = () => cb()
  document.addEventListener('webrobot:session', handler)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === SESSION_KEY) cb()
  }
  window.addEventListener('storage', storageHandler)
  return () => {
    document.removeEventListener('webrobot:session', handler)
    window.removeEventListener('storage', storageHandler)
  }
}

export function createDefaultAuth(): AuthAdapter {
  return {
    getToken: () => getSession()?.accessToken || null,
    getUser: () => getSession()?.user || null,
    onSessionChange: (cb) => watchSession(cb),
  }
}
