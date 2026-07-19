import type { IdentityProviderAdapter } from '@/lib/identity/providers/types'
import { describe, expect, it } from 'vitest'
import { fakeIdentityProviderAdapter } from '@/lib/identity/providers/fake'
import { genericWebhookAdapter } from '@/lib/identity/providers/generic-webhook'

function assertAdapterContract(adapter: IdentityProviderAdapter<any>) {
  expect(adapter.key).toMatch(/^[a-z][a-z0-9_]+$/)
  expect(adapter.contractVersion).toBe(1)
  expect(typeof adapter.validateConfig).toBe('function')
  expect(typeof adapter.healthCheck).toBe('function')
  expect(typeof adapter.createSession).toBe('function')
  expect(typeof adapter.parseWebhook).toBe('function')
  expect(typeof adapter.capabilities.deletion).toBe('boolean')
  if (adapter.capabilities.deletion) {
    expect(typeof adapter.deleteCase).toBe('function')
  }
}

describe.each([
  ['generic webhook', genericWebhookAdapter],
  ['deterministic fake', fakeIdentityProviderAdapter],
] as const)('%s identity adapter contract', (_name, adapter) => {
  it('exposes the stable adapter contract and capability-dependent methods', () => {
    assertAdapterContract(adapter)
  })
})

describe('deterministic fake identity adapter', () => {
  it('returns deterministic sessions, decisions, deletion and redaction', async () => {
    const config = fakeIdentityProviderAdapter.validateConfig({ decision: 'approved' }, 'sandbox')
    const session = await fakeIdentityProviderAdapter.createSession({
      config,
      secret: 'unused',
      caseId: 'case-1',
      submissionId: 'submission-1',
      userId: 'user-1',
      externalReference: 'external-1',
      returnUrl: 'https://app.example/return',
    })
    expect(session.externalReference).toBe('external-1')
    expect((await fakeIdentityProviderAdapter.deleteCase!({ config, secret: 'unused', externalReference: 'external-1' })).deleted).toBe(true)
    expect((await fakeIdentityProviderAdapter.redactCase!({ config, secret: 'unused', externalReference: 'external-1' })).redacted).toBe(true)
  })
})
