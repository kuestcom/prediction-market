import type { IdentitySubmissionStatus } from '@/lib/identity/types'

interface IdentityProviderCapabilities {
  hostedRedirect: boolean
  embeddedSdk: boolean
  documents: boolean
  liveness: boolean
  age: boolean
  address: boolean
  sanctionsPep: boolean
  ongoingMonitoring: boolean
  deletion: boolean
  sandbox: boolean
}

interface IdentityProviderSession {
  externalReference: string
  sessionUrl: string
  expiresAt: Date
}

interface IdentityProviderEvent {
  eventId: string
  externalReference: string
  eventType: string
  status: string
  decision: Exclude<IdentitySubmissionStatus, 'not_required' | 'not_started' | 'draft'>
  reasonCode: string | null
  occurredAt: Date
}

export interface IdentityProviderAdapter<TPublicConfig = Record<string, unknown>> {
  key: string
  contractVersion: 1
  capabilities: IdentityProviderCapabilities
  validateConfig: (config: unknown, environment: 'sandbox' | 'production') => TPublicConfig
  healthCheck: (config: TPublicConfig) => Promise<{ healthy: boolean, detail: string }>
  createCase?: (input: {
    config: TPublicConfig
    secret: string
    caseId: string
    submissionId: string
    userId: string
    externalReference: string
  }) => Promise<{ externalReference: string }>
  createSession: (input: {
    config: TPublicConfig
    secret: string
    caseId: string
    submissionId: string
    userId: string
    externalReference: string
    returnUrl: string
  }) => Promise<IdentityProviderSession>
  parseWebhook: (input: {
    config: TPublicConfig
    secret: string
    headers: Headers
    rawBody: string
    now?: Date
  }) => IdentityProviderEvent
  getCase?: (input: { config: TPublicConfig, secret: string, externalReference: string }) => Promise<{
    status: string
    decision: IdentityProviderEvent['decision'] | null
  }>
  deleteCase?: (input: { config: TPublicConfig, secret: string, externalReference: string }) => Promise<{
    deleted: boolean
    detail: string
  }>
  redactCase?: (input: { config: TPublicConfig, secret: string, externalReference: string }) => Promise<{
    redacted: boolean
    detail: string
  }>
}
