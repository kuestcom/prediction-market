import { useSyncExternalStore } from 'react'

function scrollToLocationHash() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const targetId = window.location.hash.slice(1)
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  })
}

function subscribeToLocationHash(onStoreChange: () => void) {
  function handleHashChange() {
    onStoreChange()
    scrollToLocationHash()
  }

  window.addEventListener('hashchange', handleHashChange)
  scrollToLocationHash()
  return () => window.removeEventListener('hashchange', handleHashChange)
}

function getLocationHashSnapshot() {
  return window.location.hash.slice(1)
}

function getLocationHashServerSnapshot() {
  return ''
}

export function useLocationHash() {
  return useSyncExternalStore(
    subscribeToLocationHash,
    getLocationHashSnapshot,
    getLocationHashServerSnapshot,
  )
}
