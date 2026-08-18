import type { RobotConfig } from '../types'
import type { UIElements } from './template'
import { CLICK_SLOP, posKey } from '../core/config'

export interface Position {
  x: number
  y: number
}

export function loadPos(appId: string): Position | null {
  try {
    const raw = localStorage.getItem(posKey(appId))
    if (!raw) return null
    return JSON.parse(raw) as Position
  } catch {
    return null
  }
}

export function savePos(appId: string, p: Position): void {
  localStorage.setItem(posKey(appId), JSON.stringify(p))
}

export function place(el: UIElements, p: Position): void {
  const maxX = window.innerWidth - 60
  const maxY = window.innerHeight - 60
  el.robot.style.left = `${Math.max(0, Math.min(maxX, p.x))}px`
  el.robot.style.top = `${Math.max(0, Math.min(maxY, p.y))}px`
}

export function alignPanel(el: UIElements): void {
  const robotRect = el.robot.getBoundingClientRect()
  const panelW = el.panel.offsetWidth
  const panelH = el.panel.offsetHeight
  const gap = 12

  let left = robotRect.left
  let top = robotRect.top - panelH - gap

  if (top < gap) top = robotRect.bottom + gap
  if (left + panelW > window.innerWidth - gap) {
    left = window.innerWidth - panelW - gap
  }
  if (left < gap) left = gap
  if (top + panelH > window.innerHeight - gap) {
    top = window.innerHeight - panelH - gap
  }

  el.panel.style.left = `${left}px`
  el.panel.style.top = `${top}px`
}

export function setupDrag(
  el: UIElements,
  cfg: RobotConfig,
  onDragEnd: (moved: boolean) => void,
): () => void {
  let startX = 0
  let startY = 0
  let curX = 0
  let curY = 0
  let dragging = false

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement
    if (el.close.contains(target) || el.input.contains(target) || el.send.contains(target)) return
    if (target.closest('.panel-head')) {
      const rect = el.panel.getBoundingClientRect()
      startX = e.clientX
      startY = e.clientY
      curX = rect.left
      curY = rect.top
      dragging = false

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!dragging && Math.hypot(dx, dy) > CLICK_SLOP) {
          dragging = true
          el.panel.style.transition = 'none'
        }
        if (dragging) {
          el.panel.style.left = `${curX + dx}px`
          el.panel.style.top = `${curY + dy}px`
        }
      }

      const onUp = () => {
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        el.panel.style.transition = ''
        onDragEnd(dragging)
      }

      document.addEventListener('pointermove', onMove)
      document.addEventListener('pointerup', onUp)
      return
    }

    startX = e.clientX
    startY = e.clientY
    curX = el.robot.offsetLeft
    curY = el.robot.offsetTop
    dragging = false
    el.robot.classList.add('dragging')

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragging && Math.hypot(dx, dy) > CLICK_SLOP) {
        dragging = true
      }
      if (dragging) {
        const maxX = window.innerWidth - 60
        const maxY = window.innerHeight - 60
        const nx = Math.max(0, Math.min(maxX, curX + dx))
        const ny = Math.max(0, Math.min(maxY, curY + dy))
        el.robot.style.left = `${nx}px`
        el.robot.style.top = `${ny}px`
      }
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      el.robot.classList.remove('dragging')
      if (dragging) {
        savePos(cfg.appId, { x: el.robot.offsetLeft, y: el.robot.offsetTop })
      }
      onDragEnd(dragging)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const onResize = () => alignPanel(el)

  el.robot.addEventListener('pointerdown', onPointerDown)
  el.close.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('resize', onResize)

  return () => {
    el.robot.removeEventListener('pointerdown', onPointerDown)
    el.close.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('resize', onResize)
  }
}
