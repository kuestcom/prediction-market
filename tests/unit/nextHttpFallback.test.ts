import { describe, expect, it } from 'bun:test'

import { getNextHttpFallbackStatus, isNextNotFoundError } from '@/lib/errors/next-http-fallback'

describe('nextHttpFallback', () => {
  it('returns the status from a Next.js http fallback digest', () => {
    expect(
      getNextHttpFallbackStatus({
        digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
      }),
    ).toBe(404)
  })

  it('identifies Next.js not found fallback errors', () => {
    expect(
      isNextNotFoundError({
        digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
      }),
    ).toBe(true)
  })

  it('ignores non fallback errors', () => {
    expect(
      getNextHttpFallbackStatus({
        digest: 'some-other-error',
      }),
    ).toBeNull()
    expect(isNextNotFoundError(new Error('boom'))).toBe(false)
  })
})
