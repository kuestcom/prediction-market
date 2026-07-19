import type { IdentitySubmissionStatus } from './types'

const ALLOWED_TRANSITIONS: Record<IdentitySubmissionStatus, ReadonlySet<IdentitySubmissionStatus>> = {
  not_required: new Set(['not_started']),
  not_started: new Set(['draft', 'not_required']),
  draft: new Set(['pending', 'under_review', 'approved', 'rejected']),
  pending: new Set(['under_review', 'approved', 'rejected', 'needs_resubmission', 'expired', 'suspended']),
  under_review: new Set(['approved', 'rejected', 'needs_resubmission', 'expired', 'suspended']),
  approved: new Set(['expired', 'suspended', 'needs_resubmission']),
  rejected: new Set(['draft', 'needs_resubmission']),
  needs_resubmission: new Set(['draft', 'pending', 'under_review', 'approved', 'rejected']),
  expired: new Set(['draft', 'needs_resubmission']),
  suspended: new Set(['under_review', 'approved', 'rejected', 'needs_resubmission', 'expired']),
}

export function canTransitionIdentityStatus(from: IdentitySubmissionStatus, to: IdentitySubmissionStatus) {
  return from === to || ALLOWED_TRANSITIONS[from].has(to)
}

export function assertIdentityStatusTransition(from: IdentitySubmissionStatus, to: IdentitySubmissionStatus) {
  if (!canTransitionIdentityStatus(from, to)) {
    throw new Error(`Invalid identity status transition: ${from} -> ${to}.`)
  }
}
