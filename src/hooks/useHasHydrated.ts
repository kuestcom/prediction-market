import { useSyncExternalStore } from 'react'

function subscribeToHydrationStore() {
  return function unsubscribeFromHydrationStore() {}
}

function getHydratedClientSnapshot() {
  return true
}

function getHydratedServerSnapshot() {
  return false
}

export function useHasHydrated() {
  return useSyncExternalStore(subscribeToHydrationStore, getHydratedClientSnapshot, getHydratedServerSnapshot)
}
