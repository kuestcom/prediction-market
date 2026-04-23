import { useSyncExternalStore } from 'react'

interface WindowSize {
  width: number
  height: number
}

const INITIAL_WINDOW_SIZE: WindowSize = { width: 0, height: 0 }

let cachedWindowSize = INITIAL_WINDOW_SIZE
const subscribers = new Set<() => void>()
let isListeningForWindowResize = false
let initialWindowSizeFrame: number | null = null

function readWindowSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function publishWindowSizeIfChanged() {
  if (typeof window === 'undefined') {
    return
  }

  const nextWindowSize = readWindowSize()
  if (
    cachedWindowSize.width === nextWindowSize.width
    && cachedWindowSize.height === nextWindowSize.height
  ) {
    return
  }

  cachedWindowSize = nextWindowSize
  subscribers.forEach(subscriber => subscriber())
}

function subscribeToWindowSizeStore(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return function unsubscribeFromWindowSizeStore() {}
  }

  subscribers.add(onStoreChange)

  if (!isListeningForWindowResize) {
    isListeningForWindowResize = true
    window.addEventListener('resize', publishWindowSizeIfChanged)
    initialWindowSizeFrame = window.requestAnimationFrame(publishWindowSizeIfChanged)
  }

  return function unsubscribeFromWindowSizeStore() {
    subscribers.delete(onStoreChange)

    if (subscribers.size > 0 || !isListeningForWindowResize) {
      return
    }

    if (initialWindowSizeFrame != null) {
      window.cancelAnimationFrame(initialWindowSizeFrame)
      initialWindowSizeFrame = null
    }

    window.removeEventListener('resize', publishWindowSizeIfChanged)
    isListeningForWindowResize = false
  }
}

function getWindowSizeClientSnapshot() {
  return cachedWindowSize
}

function getWindowSizeServerSnapshot() {
  return INITIAL_WINDOW_SIZE
}

export function useWindowSize() {
  return useSyncExternalStore(
    subscribeToWindowSizeStore,
    getWindowSizeClientSnapshot,
    getWindowSizeServerSnapshot,
  )
}
