import { NextResponse } from 'next/server'
import { SumsubRepository } from '@/lib/db/queries/sumsub'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeSumsubApplicantStatus, SumsubClient, SumsubClientError } from '@/lib/sumsub/client'
import { getSumsubSettings } from '@/lib/sumsub/settings'

export async function POST() {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const settings = await getSumsubSettings()
    if (!settings.effective) {
      return NextResponse.json({ error: 'Identity verification is not available.' }, { status: 409 })
    }
    if (!await SumsubRepository.consumeAccessTokenRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many verification requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }

    const applicant = await SumsubRepository.ensureUser(user.id, settings.levelName)
    const client = new SumsubClient(settings)
    const existing = await client.getApplicantByExternalUserId(applicant.external_user_id)
    if (existing?.id) {
      const levelChanged = Boolean(existing.levelName && existing.levelName !== settings.levelName)
      const sameLevel = existing.levelName === settings.levelName
      if (levelChanged) {
        await client.moveApplicantToLevel(existing.id, settings.levelName)
      }
      if (applicant.applicant_id !== existing.id) {
        await SumsubRepository.attachApplicant(user.id, settings.levelName, existing.id)
      }
      if (sameLevel) {
        await SumsubRepository.syncApplicantStatus(
          user.id,
          settings.levelName,
          normalizeSumsubApplicantStatus(existing),
          existing.review?.reviewStatus,
          existing.review?.reviewResult?.reviewAnswer,
        )
      }
    }

    const token = await client.createAccessToken(applicant.external_user_id, settings.levelName)
    if (!applicant.applicant_id && !existing?.id) {
      const created = await client.getApplicantByExternalUserId(applicant.external_user_id)
      if (created?.id) {
        await SumsubRepository.attachApplicant(user.id, settings.levelName, created.id)
      }
    }
    return NextResponse.json({ token, levelName: settings.levelName }, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch (error) {
    const status = error instanceof SumsubClientError ? error.status : 503
    const message = error instanceof SumsubClientError ? error.message : 'Verification is temporarily unavailable.'
    return NextResponse.json({ error: message }, { status })
  }
}
