'use client'

import { useEffect } from 'react'

export function useMarketSearchShortcut(onOpen: () => void): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      if (!((e.metaKey || e.ctrlKey) && e.key === 'k')) {
        return
      }
      e.preventDefault()
      onOpen()
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [onOpen])
}
