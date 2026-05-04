import { useSyncExternalStore } from 'react'

function getColumnsFromWidth(width: number) {
  return width >= 1280
    ? 4
    : width >= 1024
      ? 3
      : width >= 768
        ? 2
        : 1
}

function getServerSnapshot() {
  return 4
}

function getSnapshot() {
  return getColumnsFromWidth(window.innerWidth)
}

function subscribe(callback: () => void) {
  const mediaQueries = [
    window.matchMedia('(min-width: 1280px)'),
    window.matchMedia('(min-width: 1024px)'),
    window.matchMedia('(min-width: 768px)'),
  ]

  mediaQueries.forEach(mq => mq.addEventListener('change', callback))

  return () => {
    mediaQueries.forEach(mq => mq.removeEventListener('change', callback))
  }
}

export function useColumns(maxColumns = Number.POSITIVE_INFINITY) {
  const columns = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return Math.min(columns, maxColumns)
}
