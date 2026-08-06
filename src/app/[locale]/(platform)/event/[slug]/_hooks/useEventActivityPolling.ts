'use client'

import { useEffect, useRef } from 'react'

import type { ActivityOrder } from '@/types'

import { EVENT_ACTIVITY_REFRESH_SIZE, fetchEventTrades } from '@/lib/data-api/trades'

export const EVENT_ACTIVITY_POLL_INTERVAL_MS = 60_000

interface UseEventActivityPollingOptions {
  hasMarkets: boolean
  isActivityQueryFetching: boolean
  marketIds: string[]
  minAmountFilter: string
  onActivities: (activities: ActivityOrder[]) => void
}

export function useEventActivityPolling({
  hasMarkets,
  isActivityQueryFetching,
  marketIds,
  minAmountFilter,
  onActivities,
}: UseEventActivityPollingOptions) {
  const isActivityQueryFetchingRef = useRef(isActivityQueryFetching)

  useEffect(() => {
    isActivityQueryFetchingRef.current = isActivityQueryFetching
  }, [isActivityQueryFetching])

  useEffect(
    function pollLatestActivityWhilePageVisible() {
      if (!hasMarkets) {
        return
      }

      let activeController: AbortController | null = null
      let isPolling = false

      async function refreshLatestActivity() {
        if (document.hidden || isActivityQueryFetchingRef.current || isPolling) {
          return
        }

        isPolling = true
        const controller = new AbortController()
        activeController = controller

        try {
          const latest = await fetchEventTrades({
            marketIds,
            pageParam: 0,
            pageSize: EVENT_ACTIVITY_REFRESH_SIZE,
            minAmountFilter,
            signal: controller.signal,
          })

          if (!controller.signal.aborted) {
            onActivities(latest)
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Failed to refresh activity feed', error)
          }
        } finally {
          if (activeController === controller) {
            activeController = null
          }
          isPolling = false
        }
      }

      const interval = window.setInterval(() => {
        void refreshLatestActivity()
      }, EVENT_ACTIVITY_POLL_INTERVAL_MS)

      return function stopLatestActivityPolling() {
        window.clearInterval(interval)
        activeController?.abort()
      }
    },
    [hasMarkets, marketIds, minAmountFilter, onActivities],
  )
}
