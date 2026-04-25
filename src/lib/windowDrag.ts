import type { Dispatch, PointerEvent, SetStateAction } from 'react'
import type { WindowPosition } from '../types/apps'

const WINDOW_EDGE_PADDING = 12

export const startWindowDrag = (
  event: PointerEvent<HTMLDivElement>,
  windowElement: HTMLDivElement | null,
  setPosition: Dispatch<SetStateAction<WindowPosition | null>>,
  isMaximized: boolean,
) => {
  if (isMaximized || !windowElement || event.button !== 0) return
  if ((event.target as HTMLElement).closest('button')) return

  const rect = windowElement.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  const maxX = window.innerWidth - rect.width
  const maxY = window.innerHeight - WINDOW_EDGE_PADDING - rect.height
  const dragHandle = event.currentTarget
  let animationFrame = 0
  let currentPosition = {
    x: Math.min(Math.max(rect.left, 0), Math.max(0, maxX)),
    y: Math.min(Math.max(rect.top, 0), Math.max(0, maxY)),
  }

  const applyPosition = () => {
    animationFrame = 0
    windowElement.style.left = `${currentPosition.x}px`
    windowElement.style.top = `${currentPosition.y}px`
  }

  dragHandle.setPointerCapture(event.pointerId)
  setPosition(currentPosition)
  applyPosition()

  const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
    const nextX = moveEvent.clientX - offsetX
    const nextY = moveEvent.clientY - offsetY

    currentPosition = {
      x: Math.min(Math.max(nextX, 0), Math.max(0, maxX)),
      y: Math.min(Math.max(nextY, 0), Math.max(0, maxY)),
    }

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(applyPosition)
    }
  }

  const stopDrag = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
      applyPosition()
    }

    setPosition(currentPosition)
    if (dragHandle.hasPointerCapture(event.pointerId)) {
      dragHandle.releasePointerCapture(event.pointerId)
    }
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDrag)
    window.removeEventListener('pointercancel', stopDrag)
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}
