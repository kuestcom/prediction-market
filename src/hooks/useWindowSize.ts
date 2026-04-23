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

  function publishWindowSizeIfChanged() {
    const nextWindowSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    if (
      cachedWindowSize.width === nextWindowSize.width
      && cachedWindowSize.height === nextWindowSize.height
    ) {
      return
    }

    cachedWindowSize = nextWindowSize
    onStoreChange()
  }

  window.addEventListener('resize', publishWindowSizeIfChanged)
  const initialFrame = window.requestAnimationFrame(publishWindowSizeIfChanged)

  return function unsubscribeFromWindowSizeStore() {
    window.cancelAnimationFrame(initialFrame)
    window.removeEventListener('resize', publishWindowSizeIfChanged)
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
