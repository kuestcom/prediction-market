import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createIdentityBlindIndex,
  decryptIdentityValue,
  encryptIdentityValue,
  resetIdentityEncryptionKeyringForTests,
} from '@/lib/identity/encryption'
import { genericWebhookAdapter } from '@/lib/identity/providers/generic-webhook'

const originalEnvironment = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnvironment }
  resetIdentityEncryptionKeyringForTests()
})

describe('identity cryptography and provider boundary', () => {
  it('encrypts with authenticated context and supports key IDs', () => {
    const key = Buffer.alloc(32, 7).toString('base64')
    process.env.IDENTITY_ENCRYPTION_KEYS = JSON.stringify({ k2026: key })
    process.env.IDENTITY_ENCRYPTION_CURRENT_KEY_ID = 'k2026'
    resetIdentityEncryptionKeyringForTests()

    const encrypted = encryptIdentityValue({ cpf: '52998224725' }, 'submission:1')
    expect(encrypted.keyId).toBe('k2026')
    expect(encrypted.encryptedValue).not.toContain('52998224725')
    expect(decryptIdentityValue(encrypted.encryptedValue, 'submission:1')).toEqual({ cpf: '52998224725' })
    expect(() => decryptIdentityValue(encrypted.encryptedValue, 'submission:2')).toThrow()
  })

  it('decrypts envelopes whose configured key ID contains dots', () => {
    const key = Buffer.alloc(32, 8).toString('base64')
    process.env.IDENTITY_ENCRYPTION_KEYS = JSON.stringify({ 'region.prod.2026': key })
    process.env.IDENTITY_ENCRYPTION_CURRENT_KEY_ID = 'region.prod.2026'
    resetIdentityEncryptionKeyringForTests()

    const encrypted = encryptIdentityValue({ document: 'verified' }, 'submission:dotted-key')

    expect(encrypted.keyId).toBe('region.prod.2026')
    expect(decryptIdentityValue(encrypted.encryptedValue, 'submission:dotted-key')).toEqual({ document: 'verified' })
  })

  it('uses a separate deterministic blind-index key', () => {
    process.env.IDENTITY_BLIND_INDEX_KEY = Buffer.alloc(32, 9).toString('base64')
    const first = createIdentityBlindIndex('national_id', '52998224725')
    expect(createIdentityBlindIndex('national_id', '52998224725')).toBe(first)
    expect(createIdentityBlindIndex('other_field', '52998224725')).not.toBe(first)
  })

  it('verifies signed provider events and maps vendor statuses', () => {
    const secret = 'a'.repeat(32)
    const config = genericWebhookAdapter.validateConfig({
      verificationUrl: 'https://provider.example/verify',
      deletionUrl: 'https://provider.example/delete',
      statusMapping: { complete: 'approved' },
    }, 'production')
    const rawBody = JSON.stringify({
      eventId: 'event-1',
      reference: 'case-1',
      type: 'verification.completed',
      status: 'complete',
      reasonCode: 'PROVIDER_APPROVED',
      occurredAt: '2026-07-18T12:00:00.000Z',
    })
    const timestamp = String(Date.parse('2026-07-18T12:00:30.000Z') / 1000)
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('base64url')
    const event = genericWebhookAdapter.parseWebhook({
      config,
      secret,
      rawBody,
      headers: new Headers({ 'x-identity-timestamp': timestamp, 'x-identity-signature': `v1=${signature}` }),
      now: new Date('2026-07-18T12:00:30.000Z'),
    })
    expect(event.decision).toBe('approved')
    expect(() => genericWebhookAdapter.parseWebhook({
      config,
      secret,
      rawBody,
      headers: new Headers({ 'x-identity-timestamp': timestamp, 'x-identity-signature': 'v1=invalid' }),
      now: new Date('2026-07-18T12:00:30.000Z'),
    })).toThrow('IDENTITY_PROVIDER_SIGNATURE_INVALID')
    expect(() => genericWebhookAdapter.parseWebhook({
      config,
      secret,
      rawBody,
      headers: new Headers({ 'x-identity-timestamp': timestamp, 'x-identity-signature': `v1=${signature}` }),
      now: new Date('2026-07-18T12:10:31.000Z'),
    })).toThrow('IDENTITY_PROVIDER_TIMESTAMP_INVALID')
  })

  it('rejects unsafe provider endpoints before making a request', () => {
    expect(() => genericWebhookAdapter.validateConfig({
      verificationUrl: 'https://127.0.0.1/verify',
      statusMapping: { complete: 'approved' },
    }, 'production')).toThrow('IDENTITY_PROVIDER_URL_PRIVATE')
  })

  it.each([
    'https://[::1]/verify',
    'https://[::]/verify',
    'https://[fc00::1]/verify',
    'https://[fd12:3456::1]/verify',
    'https://[fe80::1]/verify',
    'https://[::ffff:127.0.0.1]/verify',
  ])('rejects non-public IPv6 provider endpoint %s', (verificationUrl) => {
    expect(() => genericWebhookAdapter.validateConfig({
      verificationUrl,
      statusMapping: { complete: 'approved' },
    }, 'production')).toThrow('IDENTITY_PROVIDER_URL_PRIVATE')
  })

  it('accepts a public IPv6 provider endpoint', () => {
    expect(genericWebhookAdapter.validateConfig({
      verificationUrl: 'https://[2001:4860:4860::8888]/verify',
      statusMapping: { complete: 'approved' },
    }, 'production').verificationUrl).toBe('https://[2001:4860:4860::8888]/verify')
  })
})
