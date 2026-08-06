import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'

import { ResolutionReportContextRepository } from '@/lib/db/queries/resolution-report-context'
import { UserRepository } from '@/lib/db/queries/user'
import { fetchAllowedCreatorResolutionReports } from '@/lib/resolution-reports-server'

const REPORT_PAGE_SIZE = 50

function parseCount(value: string) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

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
    const [pendingReports, eventMarkets] = await Promise.all([
      fetchAllowedCreatorResolutionReports(),
      ResolutionReportContextRepository.getEventMarkets(eventId),
    ])
    const contextByCondition = new Map(eventMarkets.map((market) => [market.conditionId, market]))
    const reports = pendingReports.rewardMarkets.flatMap((market) => {
      const conditionId = market.conditionId?.toLowerCase()
      const marketContext = conditionId ? contextByCondition.get(conditionId) : null
      if (!conditionId || !marketContext) {
        return []
      }

      return [market.noProposal, market.yesProposal].flatMap((proposal) => {
        if (!proposal) {
          return []
        }
        const outcome = proposal.side === 2 ? ('yes' as const) : ('no' as const)
        return [
          {
            id: proposal.id,
            conditionId,
            marketTitle: marketContext.marketTitle || market.title,
            marketIconUrl: marketContext.marketIconUrl || market.icon,
            outcome,
            outcomeLabel: outcome === 'yes' ? marketContext.yesLabel : marketContext.noLabel,
            reporterProfileSlug: proposal.profile.username || proposal.wallet,
            reporterUsername: proposal.profile.username,
            reporterImage: proposal.profile.avatarUrl,
            historyCorrectCount: parseCount(proposal.history.correct),
            historyIncorrectCount: parseCount(proposal.history.incorrect),
            signedAt: new Date(Number(proposal.submittedAt) * 1_000).toISOString(),
          },
        ]
      })
    })
    reports.sort((left, right) => Date.parse(right.signedAt) - Date.parse(left.signedAt))
    const marketReportCounts = reports.reduce<Record<string, number>>((counts, report) => {
      counts[report.conditionId] = (counts[report.conditionId] ?? 0) + 1
      return counts
    }, {})

    const page = reports.slice(offset, offset + REPORT_PAGE_SIZE)
    const nextOffset = offset + page.length
    return NextResponse.json({
      reports: page,
      totalCount: reports.length,
      marketReportCounts,
      nextOffset: nextOffset < reports.length ? nextOffset : null,
    })
  } catch (error) {
    console.error('Could not load admin resolution reports:', error)
    return NextResponse.json({ error: 'Could not load resolution reports.' }, { status: 500 })
  }
}
