import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useNowTimestamp } from '@/hooks/useNowTimestamp'

function NowTimestampProbe() {
  const nowTimestamp = useNowTimestamp()
  return <span>{nowTimestamp === null ? 'pending' : nowTimestamp}</span>
}

describe('useNowTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a non-temporal sentinel while server rendering', () => {
    expect(renderToString(<NowTimestampProbe />)).toBe('<span>pending</span>')
  })

  it('updates the shared clock once per second', () => {
    vi.useFakeTimers()
    const initialTimestamp = Date.UTC(2026, 7, 6, 12, 0, 0)
    vi.setSystemTime(initialTimestamp)

    const { result, unmount } = renderHook(() => useNowTimestamp())
    expect(result.current).toBe(initialTimestamp)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(initialTimestamp + 1000)

    unmount()
  })
})
