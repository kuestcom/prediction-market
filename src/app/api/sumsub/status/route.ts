import { NextResponse } from 'next/server'
import { SumsubRepository } from '@/lib/db/queries/sumsub'
import { UserRepository } from '@/lib/db/queries/user'
import { getSumsubSettings, sanitizeSumsubSettings } from '@/lib/sumsub/settings'

export async function GET() {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    if (!await SumsubRepository.consumeStatusRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many status requests.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
    const settings = await getSumsubSettings()
    const applicant = await SumsubRepository.getForUser(user.id)
    const status = applicant?.level_name === settings.levelName ? applicant.status : 'not_started'
    return NextResponse.json({
      ...sanitizeSumsubSettings(settings),
      status,
      approvedAt: status === 'approved' ? applicant?.approved_at?.toISOString() ?? null : null,
      updatedAt: applicant?.updated_at?.toISOString() ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
  catch {
    return NextResponse.json({ error: 'Unable to load verification status.' }, { status: 503 })
  }
}
