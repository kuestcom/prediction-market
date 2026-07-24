import type { RenderHookResult } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationHash } from '@/hooks/useLocationHash'

type AnimationFrameCallbackMap = Map<number, FrameRequestCallback>

function flushAnimationFrames(callbacks: AnimationFrameCallbackMap) {
  const pendingCallbacks = Array.from(callbacks.values())
  callbacks.clear()
  pendingCallbacks.forEach(callback => callback(0))
}

describe('useLocationHash', () => {
  let callbacks: AnimationFrameCallbackMap
  let nextFrameId: number
  let hook: RenderHookResult<string, unknown> | null

  beforeEach(() => {
    callbacks = new Map()
    nextFrameId = 1
    hook = null
    window.history.replaceState(null, '', '/#brand-identity')

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frameId = nextFrameId
      nextFrameId += 1
      callbacks.set(frameId, callback)
      return frameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      callbacks.delete(frameId)
    })
  })

  afterEach(() => {
    hook?.unmount()
    vi.restoreAllMocks()
    document.body.replaceChildren()
    window.history.replaceState(null, '', '/')
  })

  it('ignores environments without scrollIntoView', () => {
    const target = document.createElement('div')
    target.id = 'brand-identity'
    document.body.append(target)
    hook = renderHook(() => useLocationHash())

    expect(() => {
      act(() => flushAnimationFrames(callbacks))
      act(() => flushAnimationFrames(callbacks))
    }).not.toThrow()
  })

  it('cancels pending animation frames during cleanup', () => {
    hook = renderHook(() => useLocationHash())

    act(() => flushAnimationFrames(callbacks))
    expect(callbacks.size).toBe(1)

    hook.unmount()
    hook = null

    expect(callbacks.size).toBe(0)
  })
})
