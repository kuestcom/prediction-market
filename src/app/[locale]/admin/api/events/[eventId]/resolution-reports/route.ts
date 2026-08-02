import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { ResolutionReportRepository } from '@/lib/db/queries/resolution-report'
import { UserRepository } from '@/lib/db/queries/user'

export async function GET(_request: NextRequest, context: { params: Promise<{ eventId: string; locale: string }> }) {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  if (!currentUser?.is_admin) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const { eventId } = await context.params
  if (!eventId || eventId.length > 26) {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
  }

  try {
    const reports = await ResolutionReportRepository.getAdminEventReports(eventId)
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Could not load admin resolution reports:', error)
    return NextResponse.json({ error: 'Could not load resolution reports.' }, { status: 500 })
  }
}
