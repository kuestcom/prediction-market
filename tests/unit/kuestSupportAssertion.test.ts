import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createKuestSupportAssertion,
  verifyKuestSupportAssertion,
} from '@/lib/kuest-support-assertion'

const CONTEXT = {
  appVersion: 'abc123',
  feeRecipientWallet: null,
  isVercel: true,
  siteName: 'Example Market',
  siteUrl: 'https://market.example.com/admin',
  visitorEoa: '0x1111111111111111111111111111111111111111',
  visitorUsername: 'alice-admin',
}

describe('kuest Support assertion', () => {
  beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-thirty-two-characters')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('signs and verifies a short-lived normalized admin context', () => {
    const assertion = createKuestSupportAssertion(CONTEXT, 1_000)

    expect(verifyKuestSupportAssertion(assertion, 2_000)).toEqual({
      ...CONTEXT,
      siteUrl: 'https://market.example.com',
    })
  })

  it('rejects tampering and expiration', () => {
    const assertion = createKuestSupportAssertion(CONTEXT, 1_000)
    const [payload, signature] = assertion.split('.')

    expect(verifyKuestSupportAssertion(`${payload}x.${signature}`, 2_000)).toBeNull()
    expect(verifyKuestSupportAssertion(assertion, 121_001)).toBeNull()
  })

  it('accepts a missing username for assertions created before username support', () => {
    const assertion = createKuestSupportAssertion({
      ...CONTEXT,
      visitorUsername: null,
    }, 1_000)

    expect(verifyKuestSupportAssertion(assertion, 2_000)).toMatchObject({
      visitorUsername: null,
    })
  })

  it('omits an unsupported historical username without blocking support', () => {
    const assertion = createKuestSupportAssertion({
      ...CONTEXT,
      visitorUsername: 'legacy_username',
    }, 1_000)

    expect(verifyKuestSupportAssertion(assertion, 2_000)).toMatchObject({
      visitorUsername: null,
    })
  })
})
