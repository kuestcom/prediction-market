import { afterEach, describe, expect, it } from 'bun:test'

import { isCronAuthorized } from '@/lib/auth-cron'

import { stubEnv, unstubAllEnvs } from '../bun-test-helpers'

describe('isCronAuthorized', () => {
  afterEach(() => {
    unstubAllEnvs()
  })

  it('rejects when no secret is configured', () => {
    stubEnv('CRON_SECRET', '')
    expect(isCronAuthorized('Bearer x', undefined)).toBe(false)
  })

  it('accepts correct bearer token', () => {
    expect(isCronAuthorized('Bearer secret', 'secret')).toBe(true)
    expect(isCronAuthorized('Bearer wrong', 'secret')).toBe(false)
  })

  it('can read secret from env', () => {
    stubEnv('CRON_SECRET', 'env-secret')
    expect(isCronAuthorized('Bearer env-secret')).toBe(true)
    expect(isCronAuthorized('Bearer nope')).toBe(false)
  })
})
