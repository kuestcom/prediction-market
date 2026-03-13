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
    setCurrentTimestamp((current) => {
      if (current != null) {
        return current
      }

      return Date.now()
    })

    if (!intervalMs || intervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [intervalMs])

  return currentTimestamp
}
