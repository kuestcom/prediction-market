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

  useEffect(() => {
    setCurrentTimestamp(Date.now())

    if (!intervalMs || intervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [initialTimestamp, intervalMs])

  return currentTimestamp
}
