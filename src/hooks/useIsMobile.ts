import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 1024
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribeToIsMobileStore(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener('change', onStoreChange)
  return function unsubscribeFromIsMobileStore() {
    mql.removeEventListener('change', onStoreChange)
  }
}

function getIsMobileClientSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getIsMobileServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribeToIsMobileStore,
    getIsMobileClientSnapshot,
    getIsMobileServerSnapshot,
  )
}
