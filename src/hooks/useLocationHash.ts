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

export function clearLocationHash() {
  if (!window.location.hash) {
    return
  }

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
  window.dispatchEvent(new Event('hashchange'))
}

export function useLocationHash() {
  return useSyncExternalStore(
    subscribeToLocationHash,
    getLocationHashSnapshot,
    getLocationHashServerSnapshot,
  )
}
