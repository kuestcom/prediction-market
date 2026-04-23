import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useWindowSize } from '@/hooks/useWindowSize'

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  })
}

describe('useWindowSize', () => {
  it('notifies every subscriber when the viewport changes', async () => {
    const first = renderHook(() => useWindowSize())
    const second = renderHook(() => useWindowSize())

    act(() => {
      setWindowSize(1111, 777)
      window.dispatchEvent(new Event('resize'))
    })

    act(() => {
      setWindowSize(2222, 888)
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(first.result.current).toEqual({ width: 2222, height: 888 })
      expect(second.result.current).toEqual({ width: 2222, height: 888 })
    })
  })
})
