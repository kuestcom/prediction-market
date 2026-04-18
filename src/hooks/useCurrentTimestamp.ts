'use client'

import { useEffect, useState } from 'react'

interface UseCurrentTimestampOptions {
  initialTimestamp?: number | null
  intervalMs?: number | false
}

export function useCurrentTimestamp({
  initialTimestamp = null,
  intervalMs = false,
}: UseCurrentTimestampOptions = {}) {
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(initialTimestamp)

  useEffect(function bindCurrentTimestampInterval() {
    if (!intervalMs || intervalMs <= 0) {
      return
    }

    function updateCurrentTimestamp() {
      setCurrentTimestamp(Date.now())
    }

    const initialTimeout = window.setTimeout(updateCurrentTimestamp, 0)
    const interval = window.setInterval(updateCurrentTimestamp, intervalMs)

    return function clearCurrentTimestampInterval() {
      window.clearTimeout(initialTimeout)
      window.clearInterval(interval)
    }
  }, [intervalMs])

  return currentTimestamp
}
