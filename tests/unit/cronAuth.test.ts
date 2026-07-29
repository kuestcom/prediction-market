import { afterEach, describe, expect, it, vi } from 'vitest'

import { isCronAuthorized } from '@/lib/auth-cron'

describe('isCronAuthorized', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects when no secret is configured', () => {
    vi.stubEnv('CRON_SECRET', '')
    expect(isCronAuthorized('Bearer x', undefined)).toBe(false)
  })

  it('accepts correct bearer token', () => {
    expect(isCronAuthorized('Bearer secret', 'secret')).toBe(true)
    expect(isCronAuthorized('Bearer wrong', 'secret')).toBe(false)
  })

  it('can read secret from env', () => {
    vi.stubEnv('CRON_SECRET', 'env-secret')
    expect(isCronAuthorized('Bearer env-secret')).toBe(true)
    expect(isCronAuthorized('Bearer nope')).toBe(false)
  })
})
