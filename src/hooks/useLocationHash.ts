import { useSyncExternalStore } from 'react'

function scrollToLocationHash() {
  let innerFrameId: number | null = null
  const outerFrameId = window.requestAnimationFrame(() => {
    innerFrameId = window.requestAnimationFrame(() => {
      const targetId = window.location.hash.slice(1)
      if (targetId) {
        const target = document.getElementById(targetId)
        if (typeof target?.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    })
  })

  return function cancelLocationHashScroll() {
    window.cancelAnimationFrame(outerFrameId)
    if (innerFrameId !== null) {
      window.cancelAnimationFrame(innerFrameId)
    }
  }
}

function subscribeToLocationHash(onStoreChange: () => void) {
  let cancelScheduledScroll = scrollToLocationHash()

  function handleHashChange() {
    onStoreChange()
    cancelScheduledScroll()
    cancelScheduledScroll = scrollToLocationHash()
  }

  window.addEventListener('hashchange', handleHashChange)
  return function unsubscribeFromLocationHash() {
    window.removeEventListener('hashchange', handleHashChange)
    cancelScheduledScroll()
  }
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
