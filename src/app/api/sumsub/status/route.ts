import { NextResponse } from 'next/server'
import { SumsubRepository } from '@/lib/db/queries/sumsub'
import { UserRepository } from '@/lib/db/queries/user'
import { getSumsubSettings, sanitizeSumsubSettings } from '@/lib/sumsub/settings'

export async function GET() {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  let settings: Awaited<ReturnType<typeof getSumsubSettings>>
  try {
    settings = await getSumsubSettings()
  }
  catch {
    return NextResponse.json({ error: 'Unable to load verification status.' }, { status: 503 })
  }

  const publicSettings = sanitizeSumsubSettings(settings)
  const unavailableStatus = {
    ...publicSettings,
    status: 'error' as const,
    approvedAt: null,
    updatedAt: null,
  }

  try {
    if (!await SumsubRepository.consumeStatusRateLimit(user.id)) {
      return NextResponse.json({
        ...unavailableStatus,
        error: 'Too many status requests.',
      }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } })
    }
    const applicant = await SumsubRepository.getForUser(user.id)
    const status = applicant?.level_name === settings.levelName ? applicant.status : 'not_started'
    return NextResponse.json({
      ...publicSettings,
      status,
      approvedAt: status === 'approved' ? applicant?.approved_at?.toISOString() ?? null : null,
      updatedAt: applicant?.updated_at?.toISOString() ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch {
    return NextResponse.json({
      ...unavailableStatus,
      error: 'Unable to load verification status.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
