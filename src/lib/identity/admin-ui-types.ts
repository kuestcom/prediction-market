import type { IdentityAdminPermission, IdentityProgramInput, IdentityProgramVersionInput } from './types'

interface IdentityAdminProgramDto {
  id: string
  key: string
  name: string
  description: string
  status: string
  activeVersionId: string | null
  draftVersionId: string | null
  versionNumber: number
  versionStatus: string
  version: IdentityProgramVersionInput
  publishedVersion: IdentityProgramVersionInput | null
}

interface IdentityAdminProviderDto {
  id: string
  key: string
  displayName: string
  adapter: string
  environment: string
  enabled: boolean
  capabilities: string[]
  publicConfig: Record<string, unknown>
  secretConfigured: boolean
  secretRotatedAt: string | null
  updatedAt: string
}

interface IdentityAdminReviewQueueItem {
  id: string
  programId: string
  programName: string
  countryCode: string | null
  status: string
  evidenceLevel: string
  attemptNumber: number
  revision: number
  submittedAt: string | null
  updatedAt: string
}

export interface IdentityAdminInitialState {
  settings: { enabled: boolean, observeOnly: boolean, policyRevision: number }
  metrics: {
    statusCounts: Array<{ status: string, count: number }>
    averageReviewMinutes: number
    pendingErasures: number
    failedOutboxEvents: number
    failedProviderEvents: number
  }
  programs: IdentityAdminProgramDto[]
  providers: IdentityAdminProviderDto[]
  reviewQueue: IdentityAdminReviewQueueItem[]
  permissions: IdentityAdminPermission[]
  enabledLocales: string[]
}

export type IdentityAdminProgramDraft = IdentityProgramInput
