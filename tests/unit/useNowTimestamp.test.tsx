import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, jest } from 'bun:test'
import { renderToString } from 'react-dom/server'

import { useNowTimestamp } from '@/hooks/useNowTimestamp'

import { useFakeTimers, useRealTimers } from '../bun-test-helpers'

function NowTimestampProbe() {
  const nowTimestamp = useNowTimestamp()
  return <span>{nowTimestamp === null ? 'pending' : nowTimestamp}</span>
}

describe('useNowTimestamp', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('uses a non-temporal sentinel while server rendering', () => {
    expect(renderToString(<NowTimestampProbe />)).toBe('<span>pending</span>')
  })

  it('updates the shared clock once per second', () => {
    useFakeTimers()
    const initialTimestamp = Date.UTC(2026, 7, 6, 12, 0, 0)
    jest.setSystemTime(initialTimestamp)

    const { result, unmount } = renderHook(() => useNowTimestamp())
    expect(result.current).toBe(initialTimestamp)

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(initialTimestamp + 1000)

    unmount()
  })
})
