import { afterEach, describe, expect, it } from 'bun:test'

import { decryptSecret, encryptSecret } from '@/lib/encryption'

import { spyOn, stubEnv, unstubAllEnvs } from '../bun-test-helpers'

describe('encryption', () => {
  afterEach(() => {
    unstubAllEnvs()
  })

  it('encrypts and decrypts a secret round-trip', () => {
    stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32))

    const encrypted = encryptSecret('hello')
    expect(encrypted).toMatch(/^enc\.v1\./)
    expect(encrypted).not.toContain('hello')

    const decrypted = decryptSecret(encrypted)
    expect(decrypted).toBe('hello')
  })

  it('returns empty string for empty inputs', () => {
    stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32))
    expect(encryptSecret('')).toBe('')
    expect(decryptSecret('')).toBe('')
    expect(decryptSecret(null)).toBe('')
    expect(decryptSecret(undefined)).toBe('')
  })

  it('passes through non-prefixed values without needing a key', () => {
    stubEnv('BETTER_AUTH_SECRET', '')
    expect(decryptSecret('plain-text')).toBe('plain-text')
  })

  it('fails closed when decrypting with missing/invalid key', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      stubEnv('BETTER_AUTH_SECRET', '')
      const result = decryptSecret('enc.v1.not-base64')
      expect(result).toBe('')
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('throws when encrypting without a sufficiently long key', () => {
    stubEnv('BETTER_AUTH_SECRET', 'short')
    expect(() => encryptSecret('hello')).toThrow(/BETTER_AUTH_SECRET/)
  })
})
