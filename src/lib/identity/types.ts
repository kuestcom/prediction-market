import type { z } from 'zod'
import type {
  IDENTITY_ADMIN_PERMISSIONS,
  IDENTITY_CAPABILITIES,
  IDENTITY_SUBMISSION_STATUSES,
} from './constants'
import type {
  IdentityFieldOptionSchema,
  IdentityFieldSchema,
  IdentityProgramSchema,
  IdentityProgramVersionSchema,
} from './schemas'

export type IdentitySubmissionStatus = (typeof IDENTITY_SUBMISSION_STATUSES)[number]
export type IdentityCapability = (typeof IDENTITY_CAPABILITIES)[number]
export type IdentityAdminPermission = (typeof IDENTITY_ADMIN_PERMISSIONS)[number]

export interface IdentitySettingsSnapshot {
  enabled: boolean
  observeOnly: boolean
  policyRevision: number
}

export type IdentityFieldOptionInput = z.infer<typeof IdentityFieldOptionSchema>
export type IdentityFieldInput = z.infer<typeof IdentityFieldSchema>
export type IdentityProgramVersionInput = z.infer<typeof IdentityProgramVersionSchema>
export type IdentityProgramInput = z.infer<typeof IdentityProgramSchema>

export interface IdentityAccessDecision {
  allowed: boolean
  code: 'IDENTITY_DISABLED' | 'IDENTITY_OBSERVE_ONLY' | 'IDENTITY_NOT_REQUIRED' | 'IDENTITY_GRANTED'
    | 'IDENTITY_REQUIRED' | 'IDENTITY_PENDING' | 'IDENTITY_REJECTED' | 'IDENTITY_EXPIRED' | 'IDENTITY_SUSPENDED'
  status: IdentitySubmissionStatus | null
  capability: IdentityCapability
}
