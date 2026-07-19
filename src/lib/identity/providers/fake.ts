import type { IdentityProviderAdapter } from './types'
import { z } from 'zod'

const FakeConfigSchema = z.object({
  decision: z.enum(['pending', 'under_review', 'approved', 'rejected', 'needs_resubmission', 'expired', 'suspended']).default('approved'),
}).strict()

export const fakeIdentityProviderAdapter: IdentityProviderAdapter<z.infer<typeof FakeConfigSchema>> = {
  key: 'fake_identity_test_only',
  contractVersion: 1,
  capabilities: {
    hostedRedirect: true,
    embeddedSdk: false,
    documents: true,
    liveness: false,
    age: true,
    address: true,
    sanctionsPep: false,
    ongoingMonitoring: false,
    deletion: true,
    sandbox: true,
  },
  validateConfig(config) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('IDENTITY_FAKE_PROVIDER_PRODUCTION_FORBIDDEN')
    }
    return FakeConfigSchema.parse(config)
  },
  async healthCheck() {
    return { healthy: true, detail: 'Deterministic test adapter.' }
  },
  async createCase(input) {
    return { externalReference: input.externalReference }
  },
  async createSession(input) {
    return {
      externalReference: input.externalReference,
      sessionUrl: `https://identity-test.invalid/session/${encodeURIComponent(input.externalReference)}`,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    }
  },
  parseWebhook(input) {
    const payload = z.object({
      eventId: z.string().min(1),
      externalReference: z.string().min(1),
      occurredAt: z.iso.datetime({ offset: true }),
    }).strict().parse(JSON.parse(input.rawBody))
    return {
      eventId: payload.eventId,
      externalReference: payload.externalReference,
      eventType: 'fake.decision',
      status: input.config.decision,
      decision: input.config.decision,
      reasonCode: 'FAKE_TEST_DECISION',
      occurredAt: new Date(payload.occurredAt),
    }
  },
  async getCase(input) {
    return { status: input.config.decision, decision: input.config.decision }
  },
  async deleteCase() {
    return { deleted: true, detail: 'Deleted by deterministic test adapter.' }
  },
  async redactCase() {
    return { redacted: true, detail: 'Redacted by deterministic test adapter.' }
  },
}
