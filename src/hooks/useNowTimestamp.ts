'use client'

import { useSyncExternalStore } from 'react'

const NOW_TICK_INTERVAL_MS = 1000

let nowTimestampStore: number | null = null
const nowTimestampListeners = new Set<() => void>()
let nowTimestampInterval: number | null = null

function updateNowTimestamp() {
  nowTimestampStore = Date.now()
  for (const listener of nowTimestampListeners) {
    listener()
  }
}

function subscribeToNowTimestamp(onStoreChange: () => void) {
  nowTimestampListeners.add(onStoreChange)
  updateNowTimestamp()

  if (nowTimestampInterval === null) {
    nowTimestampInterval = window.setInterval(updateNowTimestamp, NOW_TICK_INTERVAL_MS)
  }

  return () => {
    nowTimestampListeners.delete(onStoreChange)

    if (nowTimestampListeners.size === 0 && nowTimestampInterval !== null) {
      window.clearInterval(nowTimestampInterval)
      nowTimestampInterval = null
      nowTimestampStore = null
    }
  }
}

function getNowTimestampSnapshot() {
  return nowTimestampStore
}

function getServerNowTimestampSnapshot() {
  return null
}

export function useNowTimestamp() {
  return useSyncExternalStore(subscribeToNowTimestamp, getNowTimestampSnapshot, getServerNowTimestampSnapshot)
}
