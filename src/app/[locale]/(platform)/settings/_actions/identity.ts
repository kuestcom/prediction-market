'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { IdentityProviderRepository } from '@/lib/db/queries/identity-provider'
import { IdentitySubmissionRepository } from '@/lib/db/queries/identity-submission'
import { UserRepository } from '@/lib/db/queries/user'
import { consumeIdentityRateLimit } from '@/lib/identity/rate-limit'
import { assertRecentIdentityAuthentication } from '@/lib/identity/reauth'
import resolveSiteUrl from '@/lib/site-url'

function publicError(error: unknown) {
  if (error instanceof z.ZodError) {
    return 'IDENTITY_INPUT_INVALID'
  }
  if (error instanceof Error && /^IDENTITY_[A-Z0-9_]+$/.test(error.message)) {
    return error.message
  }
  console.error('Identity user action failed', error)
  return 'IDENTITY_OPERATION_FAILED'
}

async function currentUser() {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    throw new Error('IDENTITY_UNAUTHENTICATED')
  }
  return user
}

export async function createIdentitySubmissionAction(rawInput: unknown) {
  try {
    const user = await currentUser()
    await consumeIdentityRateLimit(user.id, 'create_submission', 10, 10 * 60 * 1000)
    const submission = await IdentitySubmissionRepository.createOrResume(user.id, rawInput as never)
    revalidatePath('/settings/verification')
    return { error: null, submission }
  }
  catch (error) {
    return { error: publicError(error), submission: null }
  }
}

export async function saveIdentityAnswersAction(rawInput: unknown) {
  try {
    const user = await currentUser()
    await consumeIdentityRateLimit(user.id, 'save_answers', 60, 60 * 1000)
    const result = await IdentitySubmissionRepository.saveAnswers(user.id, rawInput as never)
    revalidatePath('/settings/verification')
    return result
  }
  catch (error) {
    return { error: publicError(error), fieldErrors: {}, status: null }
  }
}

export async function createIdentityProviderSessionAction(rawInput: unknown) {
  try {
    const user = await currentUser()
    await consumeIdentityRateLimit(user.id, 'provider_session', 10, 10 * 60 * 1000)
    const input = z.object({
      providerConfigId: z.string().length(26),
      submissionId: z.string().length(26),
      locale: z.enum(['en', 'de', 'es', 'pt', 'fr', 'zh', 'ja', 'ar', 'ru', 'it', 'pl', 'ko']),
      consentAccepted: z.boolean(),
    }).strict().parse(rawInput)
    const returnUrl = new URL(`/${input.locale}/settings/verification`, resolveSiteUrl(process.env)).toString()
    const session = await IdentityProviderRepository.createSession({
      providerConfigId: input.providerConfigId,
      submissionId: input.submissionId,
      userId: user.id,
      returnUrl,
      locale: input.locale,
      consentAccepted: input.consentAccepted,
    })
    return { error: null, session }
  }
  catch (error) {
    return { error: publicError(error), session: null }
  }
}

export async function requestIdentityCorrectionAction(rawInput: unknown) {
  try {
    const user = await currentUser()
    await assertRecentIdentityAuthentication(user.id)
    await consumeIdentityRateLimit(user.id, 'request_correction', 5, 24 * 60 * 60 * 1000)
    const result = await IdentitySubmissionRepository.requestCorrection(user.id, rawInput)
    revalidatePath('/settings/verification')
    return { error: null, result }
  }
  catch (error) {
    return { error: publicError(error), result: null }
  }
}

export async function createIdentityDataExportAction() {
  try {
    const user = await currentUser()
    await assertRecentIdentityAuthentication(user.id)
    await consumeIdentityRateLimit(user.id, 'create_export', 3, 24 * 60 * 60 * 1000)
    const result = await IdentityPrivacyRepository.createExport(user.id)
    revalidatePath('/settings/verification')
    return { error: null, result }
  }
  catch (error) {
    return { error: publicError(error), result: null }
  }
}

export async function requestIdentityErasureAction() {
  try {
    const user = await currentUser()
    await assertRecentIdentityAuthentication(user.id)
    await consumeIdentityRateLimit(user.id, 'request_erasure', 3, 24 * 60 * 60 * 1000)
    const request = await IdentityPrivacyRepository.requestErasure(user.id)
    const result = await IdentityPrivacyRepository.processErasure(request.id)
    revalidatePath('/settings/verification')
    return { error: null, result }
  }
  catch (error) {
    return { error: publicError(error), result: null }
  }
}
