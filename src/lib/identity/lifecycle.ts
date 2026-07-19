import type { IdentitySubmissionStatus } from './types'

type IdentityProgramMode = 'self_hosted' | 'provider' | 'hybrid'
type IdentityDecisionPolicy = 'manual_review' | 'auto_on_valid_submission' | 'provider_decision' | 'provider_plus_manual' | 'rules'
type IdentityEvidenceLevel = 'self_declared' | 'document_submitted' | 'provider_verified' | 'manual_verified'

export function resolveIdentityLocalFinalizationStatus(input: {
  mode: IdentityProgramMode
  decisionPolicy: IdentityDecisionPolicy
  requiredEvidence: IdentityEvidenceLevel
}): IdentitySubmissionStatus {
  if (input.mode === 'hybrid') {
    return 'pending'
  }
  if (input.decisionPolicy === 'auto_on_valid_submission'
    || (input.decisionPolicy === 'rules' && input.requiredEvidence === 'self_declared')) {
    return 'approved'
  }
  if (input.decisionPolicy === 'manual_review') {
    return 'under_review'
  }
  return 'pending'
}

export function canStartIdentityProviderSession(
  mode: IdentityProgramMode,
  status: IdentitySubmissionStatus,
) {
  if (mode === 'hybrid') {
    return status === 'pending'
  }
  return mode === 'provider' && ['draft', 'needs_resubmission', 'pending'].includes(status)
}
