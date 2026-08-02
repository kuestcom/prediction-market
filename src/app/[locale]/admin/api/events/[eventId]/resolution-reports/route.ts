import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { ResolutionReportRepository } from '@/lib/db/queries/resolution-report'
import { UserRepository } from '@/lib/db/queries/user'

const REPORT_PAGE_SIZE = 50

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string; locale: string }> }) {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  if (!currentUser?.is_admin) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const { eventId } = await context.params
  if (!eventId || eventId.length > 26) {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
  }
  const rawOffset = request.nextUrl.searchParams.get('offset') ?? '0'
  const offset = Number(rawOffset)
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: 'Invalid offset.' }, { status: 400 })
  }

  try {
    const page = await ResolutionReportRepository.getAdminEventReports(eventId, {
      limit: REPORT_PAGE_SIZE,
      offset,
    })
    const nextOffset = offset + page.reports.length
    return NextResponse.json({
      ...page,
      nextOffset: nextOffset < page.totalCount ? nextOffset : null,
    })
  } catch (error) {
    console.error('Could not load admin resolution reports:', error)
    return NextResponse.json({ error: 'Could not load resolution reports.' }, { status: 500 })
  }
}
