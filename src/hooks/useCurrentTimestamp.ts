'use client'

import { useEffect, useState } from 'react'

interface UseCurrentTimestampOptions {
  intervalMs?: number | false
}

export function useCurrentTimestamp({ intervalMs = false }: UseCurrentTimestampOptions = {}) {
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null)

  useEffect(() => {
    setCurrentTimestamp(Date.now())

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
