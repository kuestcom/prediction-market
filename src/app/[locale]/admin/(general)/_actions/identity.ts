'use server'

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getEnabledLocalesFromSettings } from '@/i18n/locale-settings'
import { IdentityDocumentRepository } from '@/lib/db/queries/identity-document'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { IdentityProgramRepository } from '@/lib/db/queries/identity-program'
import { IdentityProviderRepository } from '@/lib/db/queries/identity-provider'
import { IdentityReviewRepository } from '@/lib/db/queries/identity-review'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import {
  identity_admin_permissions,
  identity_audit_events,
  identity_document_access_tokens,
  identity_legal_holds,
  identity_provider_configs,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { assertIdentityActivationReady } from '@/lib/identity/activation'
import { assertIdentityAdminPermission } from '@/lib/identity/admin-permissions'
import {
  IDENTITY_ENABLED_SETTINGS_KEY,
  IDENTITY_OBSERVE_ONLY_SETTINGS_KEY,
  IDENTITY_POLICY_REVISION_SETTINGS_KEY,
  IDENTITY_SETTINGS_GROUP,
} from '@/lib/identity/constants'
import { getIdentityProviderAdapter } from '@/lib/identity/providers/registry'
import { assertRecentIdentityAuthentication } from '@/lib/identity/reauth'
import { parseIdentitySettings } from '@/lib/identity/settings'

const SettingsInputSchema = z.object({ enabled: z.boolean(), observeOnly: z.boolean() }).strict()
const ProgramIdSchema = z.string().length(26)
const PermissionInputSchema = z.object({
  userId: z.string().min(1).max(255),
  permission: z.enum([
    'identity_review',
    'identity_view_pii',
    'identity_export',
    'identity_delete',
    'identity_audit',
    'identity_manage_legal_hold',
  ]),
  enabled: z.boolean(),
}).strict()

function actionError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'IDENTITY_INPUT_INVALID'
  }
  if (error instanceof Error && /^IDENTITY_[A-Z0-9_]+$/.test(error.message)) {
    return error.message
  }
  console.error('Identity admin action failed', error)
  return 'IDENTITY_OPERATION_FAILED'
}

async function currentAdmin() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user?.is_admin) {
    throw new Error('IDENTITY_ADMIN_FORBIDDEN')
  }
  return user
}

async function assertAdminTwoFactor(userId: string) {
  const [record] = await db.select({ enabled: users.two_factor_enabled }).from(users).where(eq(users.id, userId)).limit(1)
  if (!record?.enabled) {
    throw new Error('IDENTITY_ADMIN_TWO_FACTOR_REQUIRED')
  }
}

export async function saveIdentitySettingsAction(rawInput: z.input<typeof SettingsInputSchema>) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const input = SettingsInputSchema.parse(rawInput)
    const { data: allSettings, error } = await SettingsRepository.getSettings()
    if (error) {
      throw new Error('IDENTITY_SETTINGS_LOAD_FAILED')
    }
    const current = parseIdentitySettings(allSettings)
    if (input.enabled) {
      const programs = await IdentityProgramRepository.listAdminPrograms()
      await assertIdentityActivationReady(programs.flatMap(program => (
        program.status === 'published' && program.publishedVersion ? [program.publishedVersion] : []
      )))
    }
    const rows = []
    if (input.enabled !== current.enabled) {
      rows.push({ group: IDENTITY_SETTINGS_GROUP, key: IDENTITY_ENABLED_SETTINGS_KEY, value: String(input.enabled) })
    }
    if (input.observeOnly !== current.observeOnly) {
      rows.push({ group: IDENTITY_SETTINGS_GROUP, key: IDENTITY_OBSERVE_ONLY_SETTINGS_KEY, value: String(input.observeOnly) })
    }
    if (rows.length > 0) {
      rows.push({
        group: IDENTITY_SETTINGS_GROUP,
        key: IDENTITY_POLICY_REVISION_SETTINGS_KEY,
        value: String(current.policyRevision + 1),
      })
      const updated = await SettingsRepository.updateSettings(rows)
      if (updated.error) {
        throw new Error('IDENTITY_SETTINGS_SAVE_FAILED')
      }
      await db.insert(identity_audit_events).values({
        actor_user_id: admin.id,
        action: 'identity.settings.saved',
        target_type: 'identity_settings',
        result: 'success',
        metadata: { enabled: input.enabled, observeOnly: input.observeOnly, policyRevision: current.policyRevision + 1 },
      })
    }
    revalidatePath('/admin')
    return { error: null, changed: rows.length > 0 }
  }
  catch (error) {
    return { error: actionError(error), changed: false }
  }
}

export async function saveIdentityProgramAction(rawInput: unknown) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const saved = await IdentityProgramRepository.saveDraft(rawInput as never, admin.id)
    revalidatePath('/admin')
    return { error: null, saved }
  }
  catch (error) {
    return { error: actionError(error), saved: null }
  }
}

export async function publishIdentityProgramAction(rawProgramId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const programId = ProgramIdSchema.parse(rawProgramId)
    const { data: settings, error } = await SettingsRepository.getSettings()
    if (error) {
      throw new Error('IDENTITY_SETTINGS_LOAD_FAILED')
    }
    const identitySettings = parseIdentitySettings(settings)
    const published = await IdentityProgramRepository.publish(
      programId,
      getEnabledLocalesFromSettings(settings ?? undefined),
      admin.id,
      identitySettings.enabled ? version => assertIdentityActivationReady([version]) : undefined,
    )
    revalidatePath('/admin')
    return { error: null, published }
  }
  catch (error) {
    return { error: actionError(error), published: null }
  }
}

export async function archiveIdentityProgramAction(rawProgramId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const archived = await IdentityProgramRepository.archive(ProgramIdSchema.parse(rawProgramId), admin.id)
    revalidatePath('/admin')
    return { error: null, archived }
  }
  catch (error) {
    return { error: actionError(error), archived: null }
  }
}

export async function cloneIdentityProgramAction(input: { programId: string, key: string, name: string }) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const parsed = z.object({
      programId: ProgramIdSchema,
      key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
      name: z.string().trim().min(1).max(160),
    }).strict().parse(input)
    const cloned = await IdentityProgramRepository.clone(parsed.programId, parsed.key, parsed.name, admin.id)
    revalidatePath('/admin')
    return { error: null, cloned }
  }
  catch (error) {
    return { error: actionError(error), cloned: null }
  }
}

export async function exportIdentityProgramAction(rawProgramId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    return { error: null, configuration: await IdentityProgramRepository.exportConfiguration(ProgramIdSchema.parse(rawProgramId)) }
  }
  catch (error) {
    return { error: actionError(error), configuration: null }
  }
}

export async function importIdentityProgramAction(input: { configuration: unknown, dryRun: boolean }) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const imported = await IdentityProgramRepository.importConfiguration(input.configuration, admin.id, input.dryRun === true)
    revalidatePath('/admin')
    return { error: null, imported }
  }
  catch (error) {
    return { error: actionError(error), imported: null }
  }
}

export async function saveIdentityProviderAction(rawInput: unknown) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const saved = await IdentityProviderRepository.saveConfig(rawInput as never, admin.id)
    revalidatePath('/admin')
    return { error: null, saved }
  }
  catch (error) {
    return { error: actionError(error), saved: null }
  }
}

export async function testIdentityProviderAction(providerId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_configure')
    const [provider] = await db.select().from(identity_provider_configs).where(eq(identity_provider_configs.id, ProgramIdSchema.parse(providerId))).limit(1)
    if (!provider) {
      throw new Error('IDENTITY_PROVIDER_NOT_FOUND')
    }
    const adapter = getIdentityProviderAdapter(provider.adapter)
    const config = adapter.validateConfig(provider.public_config, provider.environment as 'sandbox' | 'production')
    const health = await adapter.healthCheck(config)
    await db.insert(identity_audit_events).values({
      actor_user_id: admin.id,
      action: 'identity.provider.health_checked',
      target_type: 'identity_provider_config',
      target_id: provider.id,
      result: health.healthy ? 'success' : 'failed',
      metadata: { detail: health.detail },
    })
    return { error: health.healthy ? null : 'IDENTITY_PROVIDER_HEALTH_CHECK_FAILED', health }
  }
  catch (error) {
    return { error: actionError(error), health: null }
  }
}

export async function loadIdentityReviewDetailAction(rawInput: { submissionId: string, reasonCode: string }) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_review')
    await assertIdentityAdminPermission(admin, 'identity_view_pii')
    await assertAdminTwoFactor(admin.id)
    await assertRecentIdentityAuthentication(admin.id, true)
    const input = z.object({
      submissionId: ProgramIdSchema,
      reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    }).strict().parse(rawInput)
    const detail = await IdentityReviewRepository.getSubmissionDetail(input.submissionId)
    if (detail?.userId === admin.id) {
      throw new Error('IDENTITY_SELF_REVIEW_FORBIDDEN')
    }
    await db.insert(identity_audit_events).values({
      actor_user_id: admin.id,
      subject_user_id: detail?.userId ?? null,
      action: 'identity.review.pii_viewed',
      target_type: 'identity_submission',
      target_id: input.submissionId,
      reason_code: input.reasonCode,
      result: detail ? 'success' : 'denied',
      metadata: {},
    })
    return { error: null, detail }
  }
  catch (error) {
    return { error: actionError(error), detail: null }
  }
}

export async function createIdentityDocumentDownloadAction(rawInput: { documentId: string, reasonCode: string }) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_review')
    await assertIdentityAdminPermission(admin, 'identity_view_pii')
    await assertAdminTwoFactor(admin.id)
    await assertRecentIdentityAuthentication(admin.id, true)
    const input = z.object({
      documentId: ProgramIdSchema,
      reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    }).strict().parse(rawInput)
    if (!(await IdentityDocumentRepository.canAdminDownload(input.documentId))) {
      throw new Error('IDENTITY_DOCUMENT_NOT_FOUND')
    }
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('base64url')
    await db.insert(identity_document_access_tokens).values({
      document_id: input.documentId,
      requested_by_user_id: admin.id,
      token_hash: tokenHash,
      reason_code: input.reasonCode,
      expires_at: new Date(Date.now() + 60_000),
    })
    return { error: null, token }
  }
  catch (error) {
    return { error: actionError(error), token: null }
  }
}

export async function decideIdentityReviewAction(rawInput: unknown) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_review')
    await assertAdminTwoFactor(admin.id)
    await assertRecentIdentityAuthentication(admin.id, true)
    const decided = await IdentityReviewRepository.decide(admin.id, rawInput as never)
    revalidatePath('/admin')
    return { error: null, decided }
  }
  catch (error) {
    return { error: actionError(error), decided: null }
  }
}

export async function setIdentityPermissionAction(rawInput: z.input<typeof PermissionInputSchema>) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_manage_permissions')
    await assertAdminTwoFactor(admin.id)
    const input = PermissionInputSchema.parse(rawInput)
    if (input.enabled) {
      await db.insert(identity_admin_permissions).values({
        user_id: input.userId,
        permission: input.permission,
        granted_by_user_id: admin.id,
      }).onConflictDoNothing()
    }
    else {
      await db.delete(identity_admin_permissions).where(and(
        eq(identity_admin_permissions.user_id, input.userId),
        eq(identity_admin_permissions.permission, input.permission),
      ))
    }
    await db.insert(identity_audit_events).values({
      actor_user_id: admin.id,
      subject_user_id: input.userId,
      action: input.enabled ? 'identity.permission.granted' : 'identity.permission.revoked',
      target_type: 'identity_admin_permission',
      reason_code: 'ADMIN_PERMISSION_CHANGE',
      result: 'success',
      metadata: { permission: input.permission },
    })
    revalidatePath('/admin')
    return { error: null }
  }
  catch (error) {
    return { error: actionError(error) }
  }
}

export async function createIdentityLegalHoldAction(rawInput: unknown) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_manage_legal_hold')
    await assertAdminTwoFactor(admin.id)
    const input = z.object({
      userId: z.string().min(1).max(255),
      reason: z.string().trim().min(3).max(1_000),
      authority: z.string().trim().min(2).max(255),
      expiresAt: z.iso.datetime({ offset: true }),
    }).strict().superRefine((value, context) => {
      const expiresAt = new Date(value.expiresAt).getTime()
      if (expiresAt <= Date.now() || expiresAt > Date.now() + 366 * 24 * 60 * 60 * 1000) {
        context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'IDENTITY_LEGAL_HOLD_EXPIRY_INVALID' })
      }
    }).parse(rawInput)
    const [hold] = await db.insert(identity_legal_holds).values({
      user_id: input.userId,
      reason: input.reason,
      authority: input.authority,
      expires_at: new Date(input.expiresAt),
      created_by_user_id: admin.id,
    }).returning({ id: identity_legal_holds.id })
    return { error: null, hold }
  }
  catch (error) {
    return { error: actionError(error), hold: null }
  }
}

export async function releaseIdentityLegalHoldAction(holdId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_manage_legal_hold')
    await assertAdminTwoFactor(admin.id)
    const id = ProgramIdSchema.parse(holdId)
    await db.update(identity_legal_holds).set({ released_at: new Date() }).where(and(
      eq(identity_legal_holds.id, id),
      isNull(identity_legal_holds.released_at),
      or(isNull(identity_legal_holds.expires_at), gt(identity_legal_holds.expires_at, new Date())),
    ))
    return { error: null }
  }
  catch (error) {
    return { error: actionError(error) }
  }
}

export async function retryIdentityErasureAction(requestId: string) {
  try {
    const admin = await currentAdmin()
    await assertIdentityAdminPermission(admin, 'identity_delete')
    await assertAdminTwoFactor(admin.id)
    const result = await IdentityPrivacyRepository.processErasure(ProgramIdSchema.parse(requestId))
    revalidatePath('/admin')
    return { error: null, result }
  }
  catch (error) {
    return { error: actionError(error), result: null }
  }
}
