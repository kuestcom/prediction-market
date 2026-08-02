import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm'

import type { DirectResolutionOutcome } from '@/lib/direct-resolution'

import { users } from '@/lib/db/schema/auth/tables'
import { conditions, events, market_resolution_reports, markets, outcomes } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { isResolutionReportCorrect } from '@/lib/resolution-report'
import { getPublicAssetUrl } from '@/lib/storage'

export interface ResolutionReportTarget {
  conditionId: string
  eventId: string
  eventStatus: string
  marketActive: boolean
  marketResolved: boolean
  conditionResolved: boolean
  negRisk: boolean
  resolver: string | null
  oracle: string
  metadata: string | null
}

export interface ResolutionReportPublicReporter {
  seed: string
  image: string
  outcome: DirectResolutionOutcome
}

export interface AdminResolutionReport {
  id: string
  conditionId: string
  marketTitle: string
  marketIconUrl: string
  outcome: DirectResolutionOutcome
  outcomeLabel: string
  reporterProfileSlug: string
  reporterUsername: string
  reporterImage: string
  historyCorrectCount: number
  historyIncorrectCount: number
  signedAt: string
}

export const ResolutionReportRepository = {
  async getTarget(conditionId: string): Promise<ResolutionReportTarget | null> {
    const rows = await db
      .select({
        conditionId: markets.condition_id,
        eventId: markets.event_id,
        eventStatus: events.status,
        marketActive: markets.is_active,
        marketResolved: markets.is_resolved,
        conditionResolved: conditions.resolved,
        negRisk: markets.neg_risk,
        resolver: markets.resolver,
        oracle: conditions.oracle,
        metadata: markets.metadata,
      })
      .from(markets)
      .innerJoin(events, eq(events.id, markets.event_id))
      .innerJoin(conditions, eq(conditions.id, markets.condition_id))
      .where(eq(markets.condition_id, conditionId))
      .limit(1)

    const target = rows[0]
    return target ? { ...target, conditionResolved: Boolean(target.conditionResolved) } : null
  },

  async upsert(input: {
    conditionId: string
    eventId: string
    userId: string
    reporterAddress: string
    outcome: DirectResolutionOutcome
    signature: string
    nonce: string
    signedAt: Date
  }) {
    const rows = await db
      .insert(market_resolution_reports)
      .values({
        condition_id: input.conditionId,
        event_id: input.eventId,
        user_id: input.userId,
        reporter_address: input.reporterAddress.toLowerCase(),
        proposed_outcome: input.outcome,
        signature: input.signature.toLowerCase(),
        nonce: input.nonce,
        signed_at: input.signedAt,
      })
      .onConflictDoUpdate({
        target: [market_resolution_reports.condition_id, market_resolution_reports.user_id],
        set: {
          reporter_address: input.reporterAddress.toLowerCase(),
          proposed_outcome: input.outcome,
          signature: input.signature.toLowerCase(),
          nonce: input.nonce,
          signed_at: input.signedAt,
          updated_at: new Date(),
        },
      })
      .returning({
        id: market_resolution_reports.id,
        outcome: market_resolution_reports.proposed_outcome,
        updatedAt: market_resolution_reports.updated_at,
      })

    return rows[0] ?? null
  },

  async getPublicSummary(conditionId: string, currentUserId?: string | null) {
    const supportedOutcomes: DirectResolutionOutcome[] = ['yes', 'no', 'unknown']
    const [countRows, reporterRowsByOutcome, currentReportRows] = await Promise.all([
      db
        .select({ outcome: market_resolution_reports.proposed_outcome, value: count() })
        .from(market_resolution_reports)
        .where(eq(market_resolution_reports.condition_id, conditionId))
        .groupBy(market_resolution_reports.proposed_outcome),
      Promise.all(
        supportedOutcomes.map((outcome) =>
          db
            .select({
              seed: market_resolution_reports.id,
              image: users.image,
              outcome: market_resolution_reports.proposed_outcome,
            })
            .from(market_resolution_reports)
            .innerJoin(users, eq(users.id, market_resolution_reports.user_id))
            .where(
              and(
                eq(market_resolution_reports.condition_id, conditionId),
                eq(market_resolution_reports.proposed_outcome, outcome),
              ),
            )
            .orderBy(desc(market_resolution_reports.updated_at))
            .limit(5),
        ),
      ),
      currentUserId
        ? db
            .select({ outcome: market_resolution_reports.proposed_outcome })
            .from(market_resolution_reports)
            .where(
              and(
                eq(market_resolution_reports.condition_id, conditionId),
                eq(market_resolution_reports.user_id, currentUserId),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ])

    const outcomeCounts = { yes: 0, no: 0, unknown: 0 }
    for (const row of countRows) {
      if (row.outcome === 'yes' || row.outcome === 'no' || row.outcome === 'unknown') {
        outcomeCounts[row.outcome] = Number(row.value ?? 0)
      }
    }

    return {
      outcomeCounts,
      reporters: reporterRowsByOutcome.flat().map(
        (row): ResolutionReportPublicReporter => ({
          seed: row.seed,
          image: row.image ? getPublicAssetUrl(row.image) : '',
          outcome: row.outcome as DirectResolutionOutcome,
        }),
      ),
      currentOutcome: (currentReportRows[0]?.outcome as DirectResolutionOutcome | undefined) ?? null,
    }
  },

  async getAdminEventReports(eventId: string): Promise<AdminResolutionReport[]> {
    const reportRows = await db
      .select({
        id: market_resolution_reports.id,
        conditionId: market_resolution_reports.condition_id,
        marketTitle: markets.title,
        marketIconUrl: markets.icon_url,
        outcome: market_resolution_reports.proposed_outcome,
        userId: market_resolution_reports.user_id,
        reporterAddress: market_resolution_reports.reporter_address,
        reporterDepositWalletAddress: users.deposit_wallet_address,
        reporterUsername: users.username,
        reporterImage: users.image,
        signedAt: market_resolution_reports.signed_at,
      })
      .from(market_resolution_reports)
      .innerJoin(markets, eq(markets.condition_id, market_resolution_reports.condition_id))
      .innerJoin(conditions, eq(conditions.id, market_resolution_reports.condition_id))
      .innerJoin(events, eq(events.id, market_resolution_reports.event_id))
      .innerJoin(users, eq(users.id, market_resolution_reports.user_id))
      .where(
        and(
          eq(market_resolution_reports.event_id, eventId),
          eq(events.status, 'active'),
          eq(markets.is_resolved, false),
          sql`COALESCE(${conditions.resolved}, false) = false`,
        ),
      )
      .orderBy(desc(market_resolution_reports.updated_at))

    const reporterUserIds = Array.from(new Set(reportRows.map((row) => row.userId)))
    const historyRows = reporterUserIds.length
      ? await db
          .select({
            conditionId: market_resolution_reports.condition_id,
            userId: market_resolution_reports.user_id,
            proposedOutcome: market_resolution_reports.proposed_outcome,
            outcomeIndex: outcomes.outcome_index,
            payoutValue: outcomes.payout_value,
          })
          .from(market_resolution_reports)
          .innerJoin(markets, eq(markets.condition_id, market_resolution_reports.condition_id))
          .innerJoin(conditions, eq(conditions.id, market_resolution_reports.condition_id))
          .innerJoin(outcomes, eq(outcomes.condition_id, market_resolution_reports.condition_id))
          .where(
            and(
              inArray(market_resolution_reports.user_id, reporterUserIds),
              or(eq(markets.is_resolved, true), eq(conditions.resolved, true)),
              inArray(outcomes.outcome_index, [0, 1]),
            ),
          )
      : []

    const historyByProposal = new Map<
      string,
      { userId: string; proposedOutcome: DirectResolutionOutcome; yesPayout: number | null; noPayout: number | null }
    >()
    for (const row of historyRows) {
      const key = `${row.userId}:${row.conditionId}`
      const current = historyByProposal.get(key) ?? {
        userId: row.userId,
        proposedOutcome: row.proposedOutcome as DirectResolutionOutcome,
        yesPayout: null,
        noPayout: null,
      }
      const payout = row.payoutValue == null ? null : Number(row.payoutValue)
      if (row.outcomeIndex === 0) {
        current.yesPayout = payout
      } else if (row.outcomeIndex === 1) {
        current.noPayout = payout
      }
      historyByProposal.set(key, current)
    }

    const historyByUser = new Map<string, { correct: number; incorrect: number }>()
    for (const proposal of historyByProposal.values()) {
      const isCorrect = isResolutionReportCorrect(proposal.proposedOutcome, proposal.yesPayout, proposal.noPayout)
      if (isCorrect == null) {
        continue
      }
      const history = historyByUser.get(proposal.userId) ?? { correct: 0, incorrect: 0 }
      if (isCorrect) {
        history.correct += 1
      } else {
        history.incorrect += 1
      }
      historyByUser.set(proposal.userId, history)
    }

    const conditionIds = Array.from(new Set(reportRows.map((row) => row.conditionId)))
    const outcomeRows = conditionIds.length
      ? await db
          .select({
            conditionId: outcomes.condition_id,
            outcomeIndex: outcomes.outcome_index,
            outcomeText: outcomes.outcome_text,
          })
          .from(outcomes)
          .where(inArray(outcomes.condition_id, conditionIds))
      : []
    const outcomeLabelByKey = new Map(
      outcomeRows.map((row) => [`${row.conditionId}:${row.outcomeIndex}`, row.outcomeText]),
    )

    return reportRows.map((row) => {
      const outcome = row.outcome as DirectResolutionOutcome
      const outcomeIndex = outcome === 'yes' ? 0 : outcome === 'no' ? 1 : null
      return {
        id: row.id,
        conditionId: row.conditionId,
        marketTitle: row.marketTitle,
        marketIconUrl: row.marketIconUrl ? getPublicAssetUrl(row.marketIconUrl) : '',
        outcome,
        outcomeLabel:
          outcomeIndex === null
            ? 'Unknown 50/50'
            : (outcomeLabelByKey.get(`${row.conditionId}:${outcomeIndex}`) ?? outcome),
        reporterProfileSlug:
          row.reporterUsername?.trim() || row.reporterDepositWalletAddress?.trim() || row.reporterAddress,
        reporterUsername: row.reporterUsername?.trim() || '',
        reporterImage: row.reporterImage ? getPublicAssetUrl(row.reporterImage) : '',
        historyCorrectCount: historyByUser.get(row.userId)?.correct ?? 0,
        historyIncorrectCount: historyByUser.get(row.userId)?.incorrect ?? 0,
        signedAt: row.signedAt.toISOString(),
      }
    })
  },
}
