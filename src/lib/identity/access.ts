import type { IdentityAccessDecision, IdentityCapability, IdentitySubmissionStatus } from './types'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import {
  identity_access_grants,
  identity_outbox_events,
  identity_program_versions,
  identity_programs,
  identity_submissions,
  users,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { IDENTITY_ALWAYS_AVAILABLE_CAPABILITIES } from './constants'
import { IdentityAccessPolicySchema, IdentityAssignmentRulesSchema } from './schemas'
import { parseIdentitySettings } from './settings'
import 'server-only'

function statusDecisionCode(status: IdentitySubmissionStatus | null): IdentityAccessDecision['code'] {
  switch (status) {
    case 'pending':
    case 'under_review':
      return 'IDENTITY_PENDING'
    case 'rejected':
    case 'needs_resubmission':
      return 'IDENTITY_REJECTED'
    case 'expired':
      return 'IDENTITY_EXPIRED'
    case 'suspended':
      return 'IDENTITY_SUSPENDED'
    case 'not_required':
      return 'IDENTITY_NOT_REQUIRED'
    default:
      return 'IDENTITY_REQUIRED'
  }
}

function parseAccessPolicy(value: Record<string, unknown>) {
  const parsed = IdentityAccessPolicySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function assignedProgramIds<T extends { programId: string, assignmentRules: Record<string, unknown> }>(
  programs: T[],
  submissions: Array<{ program_id: string, country_code: string | null }>,
) {
  const selectedCountries = new Set(submissions.flatMap(submission => submission.country_code ? [submission.country_code] : []))
  if (selectedCountries.size === 0) {
    return new Set(programs.map(program => program.programId))
  }
  return new Set(programs.flatMap((program) => {
    const assignment = IdentityAssignmentRulesSchema.safeParse(program.assignmentRules)
    if (!assignment.success || assignment.data.countries.length === 0) {
      return [program.programId]
    }
    return assignment.data.countries.some(country => selectedCountries.has(country)) ? [program.programId] : []
  }))
}

async function getApplicableAccessPolicies(userId: string, capability: IdentityCapability) {
  const rows = await db
    .select({
      programId: identity_programs.id,
      accessPolicy: identity_program_versions.access_policy,
      assignmentRules: identity_program_versions.assignment_rules,
      publishedAt: identity_program_versions.published_at,
    })
    .from(identity_programs)
    .innerJoin(identity_program_versions, eq(identity_programs.active_version_id, identity_program_versions.id))
    .where(and(
      eq(identity_programs.status, 'published'),
      eq(identity_program_versions.status, 'published'),
    ))

  if (rows.length === 0) {
    return []
  }

  const [[user], submissions] = await Promise.all([
    db.select({ createdAt: users.created_at }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ program_id: identity_submissions.program_id, country_code: identity_submissions.country_code })
      .from(identity_submissions)
      .where(eq(identity_submissions.user_id, userId)),
  ])
  const applicableProgramIds = assignedProgramIds(rows, submissions)
  return rows.flatMap((row) => {
    if (!applicableProgramIds.has(row.programId)) {
      return []
    }
    const policy = parseAccessPolicy(row.accessPolicy)
    if (!policy || !policy.restrictedCapabilities.includes(capability)) {
      return []
    }
    if (!policy.blockExistingUsers && row.publishedAt && user && user.createdAt < row.publishedAt) {
      return []
    }
    if (policy.gracePeriodDays > 0 && row.publishedAt) {
      const enforcementAt = row.publishedAt.getTime() + policy.gracePeriodDays * 24 * 60 * 60 * 1000
      if (Date.now() < enforcementAt) {
        return []
      }
    }
    return [{ programId: row.programId, policy }]
  })
}

async function getIdentityAccessDecision(
  userId: string,
  capability: IdentityCapability,
): Promise<IdentityAccessDecision> {
  const { data: allSettings } = await SettingsRepository.getSettings()
  const settings = parseIdentitySettings(allSettings)
  if (!settings.enabled) {
    return { allowed: true, code: 'IDENTITY_DISABLED', status: null, capability }
  }
  if (settings.observeOnly) {
    return { allowed: true, code: 'IDENTITY_OBSERVE_ONLY', status: null, capability }
  }
  if (IDENTITY_ALWAYS_AVAILABLE_CAPABILITIES.has(capability)) {
    return { allowed: true, code: 'IDENTITY_NOT_REQUIRED', status: null, capability }
  }

  const policies = await getApplicableAccessPolicies(userId, capability)
  if (policies.length === 0) {
    return { allowed: true, code: 'IDENTITY_NOT_REQUIRED', status: null, capability }
  }

  const relevantProgramIds = policies.map(policy => policy.programId)
  const submissions = await db.select({
    programId: identity_submissions.program_id,
    status: identity_submissions.status,
    expiresAt: identity_submissions.expires_at,
    updatedAt: identity_submissions.updated_at,
  })
    .from(identity_submissions)
    .where(and(
      eq(identity_submissions.user_id, userId),
      inArray(identity_submissions.program_id, relevantProgramIds),
    ))
    .orderBy(desc(identity_submissions.updated_at))
  const approvedForEveryProgram = relevantProgramIds.every(programId => submissions.some(submission => (
    submission.programId === programId
    && submission.status === 'approved'
    && (!submission.expiresAt || submission.expiresAt > new Date())
  )))
  if (approvedForEveryProgram) {
    return { allowed: true, code: 'IDENTITY_GRANTED', status: 'approved', capability }
  }
  const status = (submissions[0]?.status ?? null) as IdentitySubmissionStatus | null

  return {
    allowed: false,
    code: statusDecisionCode(status),
    status,
    capability,
  }
}

export async function assertIdentityAccess(userId: string, capability: IdentityCapability) {
  const decision = await getIdentityAccessDecision(userId, capability)
  if (!decision.allowed) {
    const error = new Error(decision.code)
    Object.assign(error, { identityDecision: decision })
    throw error
  }
  return decision
}

export async function assertIdentityCollectionEnabled() {
  const { data: allSettings } = await SettingsRepository.getSettings()
  if (!parseIdentitySettings(allSettings).enabled) {
    throw new Error('IDENTITY_DISABLED')
  }
}

export async function recalculateIdentityGrants(submissionId: string) {
  return db.transaction(async (tx) => {
    const [submission] = await tx.select().from(identity_submissions).where(eq(identity_submissions.id, submissionId)).for('update')
    if (!submission) {
      throw new Error('IDENTITY_SUBMISSION_NOT_FOUND')
    }
    await tx.update(identity_access_grants).set({ revoked_at: new Date() }).where(and(
      eq(identity_access_grants.user_id, submission.user_id),
      isNull(identity_access_grants.revoked_at),
    ))

    const publishedPrograms = await tx.select({
      programId: identity_programs.id,
      version: identity_program_versions.version,
      accessPolicy: identity_program_versions.access_policy,
      assignmentRules: identity_program_versions.assignment_rules,
      publishedAt: identity_program_versions.published_at,
    }).from(identity_programs).innerJoin(identity_program_versions, eq(identity_programs.active_version_id, identity_program_versions.id)).where(and(
      eq(identity_programs.status, 'published'),
      eq(identity_program_versions.status, 'published'),
    ))
    const userSubmissions = await tx.select().from(identity_submissions).where(eq(identity_submissions.user_id, submission.user_id)).orderBy(desc(identity_submissions.updated_at))

    const [user] = await tx.select({ createdAt: users.created_at })
      .from(users)
      .where(eq(users.id, submission.user_id))
      .limit(1)
    const applicableProgramIds = assignedProgramIds(publishedPrograms, userSubmissions)
    const policies = publishedPrograms.flatMap((program) => {
      if (!applicableProgramIds.has(program.programId)) {
        return []
      }
      const policy = parseAccessPolicy(program.accessPolicy)
      if (!policy) {
        return []
      }
      if (!policy.blockExistingUsers && program.publishedAt && user && user.createdAt < program.publishedAt) {
        return []
      }
      if (policy.gracePeriodDays > 0 && program.publishedAt) {
        const enforcementAt = program.publishedAt.getTime() + policy.gracePeriodDays * 24 * 60 * 60 * 1000
        if (Date.now() < enforcementAt) {
          return []
        }
      }
      return [{ ...program, policy }]
    })
    const restrictedCapabilities = new Set(policies.flatMap(entry => entry.policy.restrictedCapabilities))
    const capabilities = [...restrictedCapabilities].filter(capability => policies
      .filter(entry => entry.policy.restrictedCapabilities.includes(capability))
      .every(entry => userSubmissions.some(candidate => (
        candidate.program_id === entry.programId
        && candidate.status === 'approved'
        && (!candidate.expires_at || candidate.expires_at > new Date())
      ))))

    const approvalExpirations = userSubmissions
      .filter(candidate => candidate.status === 'approved' && candidate.expires_at)
      .map(candidate => candidate.expires_at!)
    const expiresAt = approvalExpirations.length > 0
      ? new Date(Math.min(...approvalExpirations.map(value => value.getTime())))
      : null
    const policyRevision = policies.reduce((maximum, entry) => Math.max(maximum, entry.version), 1)

    if (capabilities.length > 0) {
      await tx.insert(identity_access_grants).values(capabilities.map(capability => ({
        user_id: submission.user_id,
        capability,
        submission_id: null,
        source: 'program_policy_set',
        policy_revision: policyRevision,
        expires_at: expiresAt,
      })))
    }

    await tx.insert(identity_outbox_events).values({
      event_type: 'identity.access.changed',
      aggregate_type: 'user',
      aggregate_id: submission.user_id,
      idempotency_key: `identity-access-changed:${submission.id}:${submission.revision}:${submission.status}`,
      payload: {
        contractVersion: 1,
        userId: submission.user_id,
        submissionId: submission.id,
        status: submission.status,
        capabilities,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    }).onConflictDoNothing()

    return { userId: submission.user_id, status: submission.status, capabilities, expiresAt }
  })
}
