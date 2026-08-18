import type { EventMap, EventHandler } from '../types'

type HandlerSet = Set<EventHandler<keyof EventMap>>

export class EventBus {
  private handlers = new Map<string, HandlerSet>()
  private maxListeners = 50

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    const key = event as string
    let set = this.handlers.get(key)
    if (!set) {
      set = new Set()
      this.handlers.set(key, set)
    }
    if (set.size >= this.maxListeners) {
      console.warn(`[web-robot] Max listeners (${this.maxListeners}) reached for "${key}"`)
      return
    }
    set.add(handler as EventHandler<keyof EventMap>)
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    const wrapper: EventHandler<K> = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    this.on(event, wrapper)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    this.handlers.get(event as string)?.delete(handler as EventHandler<keyof EventMap>)
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [payload: EventMap[K]]
  ): void {
    const set = this.handlers.get(event as string)
    if (!set) return
    for (const fn of [...set]) {
      try {
        ;(fn as (...a: unknown[]) => void)(...args)
      } catch (e) {
        console.error(`[web-robot] Event handler error for "${event as string}":`, e)
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
