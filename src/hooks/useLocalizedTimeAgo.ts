'use client'

import { useExtracted } from 'next-intl'
import { useCallback } from 'react'

import { getRelativeTimeParts } from '@/lib/formatters'

type TimeAgoInput = string | number | Date

export default function useLocalizedTimeAgo() {
  const t = useExtracted()

  const formatTimeAgo = useCallback(
    (dateInput: TimeAgoInput, nowInput: number | Date = Date.now()) => {
      const relativeTime = getRelativeTimeParts(dateInput, nowInput)
      if (!relativeTime) {
        return '—'
      }

      switch (relativeTime.unit) {
        case 'second':
          return t('{count}s ago', { count: String(relativeTime.count) })
        case 'minute':
          return t('{count}m ago', { count: String(relativeTime.count) })
        case 'hour':
          return t('{count}h ago', { count: String(relativeTime.count) })
        default:
          return t('{count}d ago', { count: String(relativeTime.count) })
      }
    },
    [t],
  )

  const formatCompactTimeAgo = useCallback(
    (dateInput: TimeAgoInput, nowInput: number | Date = Date.now()) => {
      const relativeTime = getRelativeTimeParts(dateInput, nowInput, true)
      if (!relativeTime) {
        return '—'
      }

      if (relativeTime.count === 0 && relativeTime.unit === 'second') {
        return t('now')
      }

      switch (relativeTime.unit) {
        case 'second':
          return t('{count}s', { count: String(relativeTime.count) })
        case 'minute':
          return t('{count}m', { count: String(relativeTime.count) })
        case 'hour':
          return t('{count}h', { count: String(relativeTime.count) })
        case 'day':
          return t('{count}d', { count: String(relativeTime.count) })
        case 'week':
          return t('{count}w', { count: String(relativeTime.count) })
        case 'month':
          return t('{count}mo', { count: String(relativeTime.count) })
        default:
          return t('{count}y', { count: String(relativeTime.count) })
      }
    },
    [t],
  )

  return { formatTimeAgo, formatCompactTimeAgo }
}
