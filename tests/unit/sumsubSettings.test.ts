import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptSecret, encryptSecret } from '@/lib/encryption'
import { parseSumsubSettings, validateSumsubInput } from '@/lib/sumsub/settings'

function settings(values: Record<string, string>) {
  return { integrations: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])) }
}

describe('sumsub settings', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to inactive and disabled', () => {
    expect(parseSumsubSettings()).toMatchObject({
      enabled: false,
      configured: false,
      effective: false,
      enforcement: 'disabled',
    })
  })

  it.each([
    [false, 'required', false],
    [true, 'disabled', false],
    [true, 'observe', true],
    [true, 'required', true],
  ] as const)('applies enabled=%s enforcement=%s', (enabled, enforcement, effective) => {
    expect(parseSumsubSettings(settings({
      sumsub_enabled: String(enabled),
      sumsub_app_token: 'app-token',
      sumsub_secret_key: 'secret-key',
      sumsub_webhook_secret: 'webhook-secret',
      sumsub_level_name: 'basic-kyc-level',
      sumsub_enforcement: enforcement,
    }))).toMatchObject({ enabled, configured: true, effective, enforcement })
  })

  it('rejects effective incomplete configuration', () => {
    expect(validateSumsubInput({
      enabled: 'true',
      enforcement: 'required',
      levelName: '',
      appToken: '',
      secretKey: '',
      webhookSecret: '',
    })).toMatchObject({ data: null })
  })

  it('preserves masked stored secrets during validation', () => {
    expect(validateSumsubInput({
      enabled: 'true',
      enforcement: 'observe',
      levelName: 'basic-kyc-level',
      appToken: '',
      secretKey: '',
      webhookSecret: '',
      hasStoredAppToken: true,
      hasStoredSecretKey: true,
      hasStoredWebhookSecret: true,
    }).data).toMatchObject({ enforcement: 'observe', levelName: 'basic-kyc-level' })
  })

  it('rejects unknown enforcement values', () => {
    expect(validateSumsubInput({
      enabled: false,
      enforcement: 'sometimes',
      levelName: '',
      appToken: '',
      secretKey: '',
      webhookSecret: '',
    })).toMatchObject({ data: null, error: 'Invalid Sumsub enforcement mode.' })
  })

  it('encrypts secrets at rest', () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-thirty-two-characters')
    const encrypted = encryptSecret('sumsub-secret')
    expect(encrypted).not.toContain('sumsub-secret')
    expect(decryptSecret(encrypted)).toBe('sumsub-secret')
  })

  it('seeds inactive defaults without overwriting existing settings', async () => {
    const migration = await readFile('src/lib/db/migrations/2026_07_19_001_sumsub.sql', 'utf8')
    expect(migration).toContain('(\'integrations\', \'sumsub_enabled\', \'false\')')
    expect(migration).toContain('(\'integrations\', \'sumsub_enforcement\', \'disabled\')')
    expect(migration).toContain('ON CONFLICT ("group", key) DO NOTHING')
  })
})
