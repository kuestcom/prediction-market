import { useSyncExternalStore } from 'react'

interface WindowSize {
  width: number
  height: number
}

const INITIAL_WINDOW_SIZE: WindowSize = { width: 0, height: 0 }

let cachedWindowSize = INITIAL_WINDOW_SIZE

function subscribeToWindowSizeStore(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return function unsubscribeFromWindowSizeStore() {}
  }

  window.addEventListener('resize', onStoreChange)

  return function unsubscribeFromWindowSizeStore() {
    window.removeEventListener('resize', onStoreChange)
  }
}

function getWindowSizeClientSnapshot() {
  const nextWindowSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  if (
    cachedWindowSize.width === nextWindowSize.width
    && cachedWindowSize.height === nextWindowSize.height
  ) {
    return cachedWindowSize
  }

  cachedWindowSize = nextWindowSize
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
