import { useEffect, useRef, useState } from 'react'

import { LIVE_CLOCK_FRAME_MS } from '../_utils/eventLiveSeriesChartUtils'

export function useLiveSeriesClock(isLiveView: boolean) {
  const [nowMs, setNowMs] = useState(0)
  const activeRef = useRef(false)

  useEffect(
    function syncLiveSeriesClock() {
      if (!isLiveView) {
        return
      }

      activeRef.current = true
      let frameId: number | null = null
      let lastFrameTimestamp = 0

      function animate(frameTimestamp: number) {
        if (!activeRef.current) {
          return
        }
        if (!document.hidden && frameTimestamp - lastFrameTimestamp >= LIVE_CLOCK_FRAME_MS) {
          lastFrameTimestamp = frameTimestamp
          setNowMs(Date.now())
        }
        frameId = window.requestAnimationFrame(animate)
      }

      frameId = window.requestAnimationFrame(animate)

      function handleVisibilityChange() {
        if (!document.hidden) {
          setNowMs(Date.now())
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      return function cleanupLiveSeriesClock() {
        activeRef.current = false
        if (frameId != null) {
          window.cancelAnimationFrame(frameId)
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    },
    [isLiveView],
  )

  return nowMs
}
