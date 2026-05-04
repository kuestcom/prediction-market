import type { RefObject } from 'react'
import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { INITIAL_REVEAL_DURATION, runRevealAnimation, stopRevealAnimation } from '@/lib/prediction-chart'
import { areSeriesKeyListsEqual } from '@/lib/prediction-chart-helpers'

const CROSS_FADE_DURATION = 320
const SURGE_DURATION = 760

export function usePredictionChartAnimation(params: {
  data: DataPoint[]
  series: SeriesConfig[]
  disableResetAnimation: boolean
  tooltipActive: boolean
  lastDataUpdateTypeRef: RefObject<'reset' | 'append' | 'none'>
  previousDataRef: RefObject<DataPoint[] | null>
  seriesPathRef: RefObject<Record<string, SVGPathElement | null>>
}) {
  const {
    data,
    series,
    disableResetAnimation,
    tooltipActive,
    lastDataUpdateTypeRef,
    previousDataRef,
    seriesPathRef,
  } = params

  const [revealProgress, setRevealProgress] = useState(0)
  const [crossFadeProgress, setCrossFadeProgress] = useState(1)
  const [crossFadeData, setCrossFadeData] = useState<DataPoint[] | null>(null)
  const [surgeActive, setSurgeActive] = useState(false)
  const [surgeLengths, setSurgeLengths] = useState<Record<string, number>>({})
  const [revealSeriesKeys, setRevealSeriesKeys] = useState<string[]>([])
  const revealAnimationFrameRef = useRef<number | null>(null)
  const crossFadeFrameRef = useRef<number | null>(null)
  const surgeTimeoutRef = useRef<number | null>(null)
  const surgePendingRef = useRef(false)
  const previousSeriesKeysRef = useRef<string[]>([])
  const hasPointerInteractionRef = useRef(false)
  const lastCursorProgressRef = useRef(0)
  const scheduledStateFrameIdsRef = useRef<Set<number>>(new Set())

  const cancelScheduledStateUpdates = useCallback(function cancelScheduledStateUpdates() {
    scheduledStateFrameIdsRef.current.forEach((frameId) => {
      window.cancelAnimationFrame(frameId)
    })
    scheduledStateFrameIdsRef.current.clear()
  }, [])

  const scheduleStateUpdate = useCallback(function scheduleStateUpdate(applyUpdate: () => void) {
    const frameId = window.requestAnimationFrame(() => {
      scheduledStateFrameIdsRef.current.delete(frameId)
      applyUpdate()
    })
    scheduledStateFrameIdsRef.current.add(frameId)
  }, [])

  useLayoutEffect(
    function cleanupRevealAnimation() {
      return function stopRevealOnUnmount() {
        stopRevealAnimation(revealAnimationFrameRef)
      }
    },
    [revealAnimationFrameRef],
  )

  useLayoutEffect(
    function cleanupCrossFadeAnimation() {
      return function stopCrossFadeOnUnmount() {
        stopRevealAnimation(crossFadeFrameRef)
      }
    },
    [crossFadeFrameRef],
  )

  useLayoutEffect(function cleanupSurgeTimeout() {
    return function clearSurgeOnUnmount() {
      if (surgeTimeoutRef.current) {
        window.clearTimeout(surgeTimeoutRef.current)
      }
    }
  }, [])

  useLayoutEffect(function cleanupScheduledStateUpdates() {
    return function cancelScheduledStateUpdatesOnUnmount() {
      cancelScheduledStateUpdates()
    }
  }, [cancelScheduledStateUpdates])

  useLayoutEffect(function orchestrateAnimations() {
    cancelScheduledStateUpdates()

    if (data.length === 0) {
      stopRevealAnimation(revealAnimationFrameRef)
      stopRevealAnimation(crossFadeFrameRef)
      surgePendingRef.current = false
      scheduleStateUpdate(() => {
        setRevealProgress(0)
        setCrossFadeProgress(1)
        setCrossFadeData(null)
        setSurgeActive(false)
        setSurgeLengths({})
        setRevealSeriesKeys((previousKeys) => {
          if (previousKeys.length === 0) {
            return previousKeys
          }

          return []
        })
      })
      previousSeriesKeysRef.current = series.map(item => item.key)
      lastDataUpdateTypeRef.current = 'reset'
      previousDataRef.current = data
      return
    }

    const updateType = lastDataUpdateTypeRef.current
    const previousData = previousDataRef.current
    const currentSeriesKeys = series.map(item => item.key)
    const previousSeriesKeys = previousSeriesKeysRef.current
    const addedSeries = currentSeriesKeys.filter(key => !previousSeriesKeys.includes(key))
    const removedSeries = previousSeriesKeys.filter(key => !currentSeriesKeys.includes(key))
    const seriesChanged = addedSeries.length > 0 || removedSeries.length > 0
    const hasPreviousSeries = previousSeriesKeys.length > 0
    const shouldPartialReveal = seriesChanged && addedSeries.length > 0 && hasPreviousSeries
    const nextRevealSeries = currentSeriesKeys

    scheduleStateUpdate(() => {
      setRevealSeriesKeys((previousKeys) => {
        if (areSeriesKeyListsEqual(previousKeys, nextRevealSeries)) {
          return previousKeys
        }

        return nextRevealSeries
      })
    })
    previousSeriesKeysRef.current = currentSeriesKeys
    surgePendingRef.current = updateType === 'reset' && !disableResetAnimation

    const canUseCrossFade = updateType === 'reset'
      && !disableResetAnimation
      && previousData
      && previousData.length > 0
      && !shouldPartialReveal
      && currentSeriesKeys.length <= 1

    if (canUseCrossFade) {
      hasPointerInteractionRef.current = false
      lastCursorProgressRef.current = 0
      stopRevealAnimation(revealAnimationFrameRef)
      scheduleStateUpdate(() => {
        setRevealProgress(1)
        setCrossFadeData(previousData)
      })
      runRevealAnimation({
        from: 0,
        to: 1,
        duration: CROSS_FADE_DURATION,
        frameRef: crossFadeFrameRef,
        setProgress: setCrossFadeProgress,
      })
    }
    else {
      stopRevealAnimation(crossFadeFrameRef)
      scheduleStateUpdate(() => {
        setCrossFadeProgress(1)
        setCrossFadeData(null)
      })

      if (updateType === 'reset' && !disableResetAnimation) {
        hasPointerInteractionRef.current = false
        lastCursorProgressRef.current = 0
        runRevealAnimation({
          from: 0,
          to: 1,
          duration: INITIAL_REVEAL_DURATION,
          frameRef: revealAnimationFrameRef,
          setProgress: setRevealProgress,
        })
      }
      else {
        stopRevealAnimation(revealAnimationFrameRef)
        scheduleStateUpdate(() => {
          setRevealProgress(1)
        })
      }
    }

    lastDataUpdateTypeRef.current = 'none'
    previousDataRef.current = data
  }, [
    data,
    series,
    revealAnimationFrameRef,
    crossFadeFrameRef,
    disableResetAnimation,
    lastDataUpdateTypeRef,
    previousDataRef,
    cancelScheduledStateUpdates,
    scheduleStateUpdate,
  ])

  useLayoutEffect(function clearFinishedCrossFade() {
    if (crossFadeData && crossFadeProgress >= 0.999) {
      scheduleStateUpdate(() => {
        setCrossFadeData(null)
      })
    }
  }, [crossFadeData, crossFadeProgress, scheduleStateUpdate])

  const crossFadeAnimating = Boolean(crossFadeData && crossFadeProgress < 0.999)
  const revealSeriesSet = useMemo(() => new Set(revealSeriesKeys), [revealSeriesKeys])

  useLayoutEffect(function triggerSurgeAfterReveal() {
    if (!surgePendingRef.current) {
      return
    }

    if (revealProgress < 0.999) {
      return
    }

    if (crossFadeAnimating || tooltipActive || data.length < 2 || series.length === 0 || revealSeriesKeys.length === 0) {
      return
    }

    surgePendingRef.current = false

    const nextLengths: Record<string, number> = {}
    revealSeriesKeys.forEach((seriesKey) => {
      const node = seriesPathRef.current[seriesKey]
      if (node) {
        nextLengths[seriesKey] = node.getTotalLength()
      }
    })

    if (Object.keys(nextLengths).length === 0) {
      return
    }

    scheduleStateUpdate(() => {
      setSurgeLengths(nextLengths)
      setSurgeActive(true)
    })

    if (surgeTimeoutRef.current) {
      window.clearTimeout(surgeTimeoutRef.current)
    }

    surgeTimeoutRef.current = window.setTimeout(() => {
      setSurgeActive(false)
    }, SURGE_DURATION)
  }, [revealProgress, crossFadeAnimating, tooltipActive, data.length, series, revealSeriesKeys, seriesPathRef, scheduleStateUpdate])

  return {
    revealProgress,
    setRevealProgress,
    crossFadeProgress,
    crossFadeData,
    surgeActive,
    surgeLengths,
    revealSeriesKeys,
    revealSeriesSet,
    revealAnimationFrameRef,
    crossFadeAnimating,
    surgePendingRef,
    hasPointerInteractionRef,
    lastCursorProgressRef,
  }
}

export default usePredictionChartAnimation
