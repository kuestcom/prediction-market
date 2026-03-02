import { and, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import {
  conditions as conditionsTable,
  events as eventsTable,
  markets as marketsTable,
  outcomes as outcomesTable,
  subgraph_syncs,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export const maxDuration = 300

const RESOLUTION_SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmkeqj653po3801t6ajbv1wcv/subgraphs/resolution-subgraph/1.0.0/gn'
const SYNC_TIME_LIMIT_MS = 250_000
const RESOLUTION_PAGE_SIZE = 200
const SYNC_RUNNING_STALE_MS = 15 * 60 * 1000
const SAFETY_PERIOD_V4_SECONDS = 60 * 60
const SAFETY_PERIOD_NEGRISK_SECONDS = 60 * 60
const RESOLUTION_LIVENESS_DEFAULT_SECONDS = parseOptionalInt(process.env.RESOLUTION_LIVENESS_DEFAULT_SECONDS)
const RESOLUTION_UNPROPOSED_PRICE_SENTINEL = 69n
const RESOLUTION_PRICE_YES = 1000000000000000000n
const RESOLUTION_PRICE_INVALID = 500000000000000000n

interface ResolutionCursor {
  lastUpdateTimestamp: number
  id: string
}

interface SubgraphResolution {
  id: string
  status: string
  flagged: boolean
  paused: boolean
  wasDisputed: boolean
  approved?: boolean | null
  lastUpdateTimestamp: string
  price: string | null
  liveness?: string | null
}

interface MarketContext {
  eventId: string | null
  negRisk: boolean
}

interface SyncStats {
  fetchedCount: number
  processedCount: number
  skippedCount: number
  errors: { questionId: string, error: string }[]
  timeLimitReached: boolean
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const lockAcquired = await tryAcquireSyncLock()
    if (!lockAcquired) {
      return NextResponse.json({
        success: false,
        message: 'Sync already running',
        skipped: true,
      }, { status: 409 })
    }

    const syncResult = await syncResolutions()

    await updateSyncStatus('completed', null, syncResult.processedCount)

    return NextResponse.json({
      success: true,
      fetched: syncResult.fetchedCount,
      processed: syncResult.processedCount,
      skipped: syncResult.skippedCount,
      errors: syncResult.errors.length,
      errorDetails: syncResult.errors,
      timeLimitReached: syncResult.timeLimitReached,
    })
  }
  catch (error: any) {
    await updateSyncStatus('error', error.message)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

function parseOptionalInt(rawValue?: string): number | null {
  if (!rawValue) {
    return null
  }
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function tryAcquireSyncLock(): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - SYNC_RUNNING_STALE_MS)
  const runningPayload = {
    service_name: 'resolution_sync',
    subgraph_name: 'resolution',
    status: 'running' as const,
    error_message: null,
  }

  try {
    const claimedRows = await db
      .update(subgraph_syncs)
      .set(runningPayload)
      .where(and(
        eq(subgraph_syncs.service_name, 'resolution_sync'),
        eq(subgraph_syncs.subgraph_name, 'resolution'),
        or(
          ne(subgraph_syncs.status, 'running'),
          lt(subgraph_syncs.updated_at, staleThreshold),
        ),
      ))
      .returning({ id: subgraph_syncs.id })

    if (claimedRows.length > 0) {
      return true
    }
  }
  catch (error: any) {
    if (isMissingColumnError(error, 'status')) {
      return tryAcquireLegacySyncLock()
    }
    throw new Error(`Failed to claim sync lock: ${error?.message ?? String(error)}`)
  }

  try {
    const insertedRows = await db
      .insert(subgraph_syncs)
      .values(runningPayload)
      .onConflictDoNothing()
      .returning({ id: subgraph_syncs.id })

    if (insertedRows.length > 0) {
      return true
    }

    return false
  }
  catch (error: any) {
    if (isMissingColumnError(error, 'status')) {
      return tryAcquireLegacySyncLock()
    }
    throw new Error(`Failed to initialize sync lock: ${error?.message ?? String(error)}`)
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string): boolean {
  const message = error?.message ?? ''
  return message.includes(`column subgraph_syncs.${column} does not exist`)
}

async function tryAcquireLegacySyncLock(): Promise<boolean> {
  const legacyPayload = {
    service_name: 'resolution_sync',
    subgraph_name: 'resolution',
    error_message: null,
  }

  try {
    const updatedRows = await db
      .update(subgraph_syncs)
      .set(legacyPayload)
      .where(and(
        eq(subgraph_syncs.service_name, 'resolution_sync'),
        eq(subgraph_syncs.subgraph_name, 'resolution'),
      ))
      .returning({ id: subgraph_syncs.id })

    if (updatedRows.length > 0) {
      return true
    }
  }
  catch (error: any) {
    throw new Error(`Failed to claim legacy sync lock: ${error?.message ?? String(error)}`)
  }

  try {
    const insertedRows = await db
      .insert(subgraph_syncs)
      .values(legacyPayload)
      .onConflictDoNothing()
      .returning({ id: subgraph_syncs.id })

    return insertedRows.length > 0
  }
  catch (error: any) {
    throw new Error(`Failed to initialize legacy sync lock: ${error?.message ?? String(error)}`)
  }
}

async function updateSyncStatus(
  status: 'running' | 'completed' | 'error',
  errorMessage?: string | null,
  totalProcessed?: number,
) {
  const updateData: any = {
    service_name: 'resolution_sync',
    subgraph_name: 'resolution',
    status,
  }

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage
  }

  if (totalProcessed !== undefined) {
    updateData.total_processed = totalProcessed
  }

  try {
    await db
      .insert(subgraph_syncs)
      .values(updateData)
      .onConflictDoUpdate({
        target: [subgraph_syncs.service_name, subgraph_syncs.subgraph_name],
        set: updateData,
      })
  }
  catch (error: any) {
    if (isMissingColumnError(error, 'status')) {
      return
    }
    console.error(`Failed to update sync status to ${status}:`, error)
  }
}

async function syncResolutions(): Promise<SyncStats> {
  const syncStartedAt = Date.now()
  let cursor = await getLastResolutionCursor()

  let fetchedCount = 0
  let processedCount = 0
  let skippedCount = 0
  const errors: { questionId: string, error: string }[] = []
  let timeLimitReached = false
  const eventIdsNeedingStatusUpdate = new Set<string>()

  while (Date.now() - syncStartedAt < SYNC_TIME_LIMIT_MS) {
    const page = await fetchResolutionPage(cursor)

    if (page.resolutions.length === 0) {
      break
    }

    fetchedCount += page.resolutions.length

    const resolutionIds = page.resolutions.map(resolution => resolution.id.toLowerCase())
    const conditionIdByResolutionId = new Map<string, string>()

    let conditions: { id: string, question_id: string }[] = []
    if (resolutionIds.length > 0) {
      conditions = await db
        .select({
          id: conditionsTable.id,
          question_id: conditionsTable.question_id,
        })
        .from(conditionsTable)
        .where(inArray(conditionsTable.question_id, resolutionIds))
    }

    for (const condition of conditions) {
      if (condition.question_id) {
        conditionIdByResolutionId.set(condition.question_id.toLowerCase(), condition.id)
      }
    }

    let negRiskRequestMatches: {
      condition_id: string
      event_id: string | null
      neg_risk: boolean | null
      neg_risk_request_id: string | null
    }[] = []
    if (resolutionIds.length > 0) {
      negRiskRequestMatches = await db
        .select({
          condition_id: marketsTable.condition_id,
          event_id: marketsTable.event_id,
          neg_risk: marketsTable.neg_risk,
          neg_risk_request_id: marketsTable.neg_risk_request_id,
        })
        .from(marketsTable)
        .where(inArray(marketsTable.neg_risk_request_id, resolutionIds))
    }

    for (const market of negRiskRequestMatches) {
      if (market.neg_risk_request_id) {
        conditionIdByResolutionId.set(market.neg_risk_request_id.toLowerCase(), market.condition_id)
      }
    }

    const conditionIds = Array.from(new Set([
      ...conditions.map(condition => condition.id),
      ...negRiskRequestMatches.map(market => market.condition_id),
    ]))

    let marketRows: { condition_id: string, event_id: string | null, neg_risk: boolean | null }[] = []
    if (conditionIds.length > 0) {
      marketRows = await db
        .select({
          condition_id: marketsTable.condition_id,
          event_id: marketsTable.event_id,
          neg_risk: marketsTable.neg_risk,
        })
        .from(marketsTable)
        .where(inArray(marketsTable.condition_id, conditionIds))
    }

    const marketContextMap = new Map<string, MarketContext>()
    for (const market of marketRows) {
      marketContextMap.set(market.condition_id, {
        eventId: market.event_id ?? null,
        negRisk: Boolean(market.neg_risk),
      })
    }
    for (const market of negRiskRequestMatches) {
      const current = marketContextMap.get(market.condition_id)
      marketContextMap.set(market.condition_id, {
        eventId: current?.eventId ?? market.event_id ?? null,
        negRisk: current?.negRisk ?? Boolean(market.neg_risk),
      })
    }

    let lastPersistableCursor: ResolutionCursor | null = null

    for (const resolution of page.resolutions) {
      if (Date.now() - syncStartedAt >= SYNC_TIME_LIMIT_MS) {
        timeLimitReached = true
        break
      }

      const lastUpdateTimestamp = Number(resolution.lastUpdateTimestamp)
      if (Number.isNaN(lastUpdateTimestamp)) {
        errors.push({
          questionId: resolution.id,
          error: `Invalid lastUpdateTimestamp: ${resolution.lastUpdateTimestamp}`,
        })
        continue
      }

      const conditionId = conditionIdByResolutionId.get(resolution.id.toLowerCase())
      if (!conditionId) {
        skippedCount++
        continue
      }

      const nextCursor = {
        lastUpdateTimestamp,
        id: resolution.id,
      }

      try {
        const marketContext = marketContextMap.get(conditionId) ?? { eventId: null, negRisk: false }
        const eventId = await processResolution(
          resolution,
          conditionId,
          marketContext,
        )
        if (eventId) {
          eventIdsNeedingStatusUpdate.add(eventId)
        }
        processedCount++
        lastPersistableCursor = nextCursor
      }
      catch (error: any) {
        errors.push({
          questionId: resolution.id,
          error: error.message ?? String(error),
        })
        // Avoid blocking the sync forever on a single malformed row.
        lastPersistableCursor = nextCursor
      }
    }

    if (lastPersistableCursor) {
      await updateResolutionCursor(lastPersistableCursor)
      cursor = lastPersistableCursor
    }
    else if (!timeLimitReached) {
      // Avoid stalling forever when a page only contains unknown IDs.
      const lastResolutionInPage = page.resolutions[page.resolutions.length - 1]
      const pageEndTimestamp = Number(lastResolutionInPage?.lastUpdateTimestamp)
      if (!lastResolutionInPage || Number.isNaN(pageEndTimestamp)) {
        break
      }
      const pageEndCursor = {
        lastUpdateTimestamp: pageEndTimestamp,
        id: lastResolutionInPage.id,
      }
      await updateResolutionCursor(pageEndCursor)
      cursor = pageEndCursor
    }

    if (eventIdsNeedingStatusUpdate.size > 0) {
      await updateEventStatusesFromMarketsBatch(Array.from(eventIdsNeedingStatusUpdate))
      eventIdsNeedingStatusUpdate.clear()
    }

    if (timeLimitReached || page.resolutions.length < RESOLUTION_PAGE_SIZE) {
      break
    }
  }

  if (eventIdsNeedingStatusUpdate.size > 0) {
    await updateEventStatusesFromMarketsBatch(Array.from(eventIdsNeedingStatusUpdate))
  }

  return {
    fetchedCount,
    processedCount,
    skippedCount,
    errors,
    timeLimitReached,
  }
}

async function getLastResolutionCursor(): Promise<ResolutionCursor | null> {
  const rows = await db
    .select({
      cursor_updated_at: subgraph_syncs.cursor_updated_at,
      cursor_id: subgraph_syncs.cursor_id,
    })
    .from(subgraph_syncs)
    .where(and(
      eq(subgraph_syncs.service_name, 'resolution_sync'),
      eq(subgraph_syncs.subgraph_name, 'resolution'),
    ))
    .limit(1)

  const data = rows[0]

  if (!data?.cursor_updated_at || !data?.cursor_id) {
    return null
  }

  const updatedAt = Number(data.cursor_updated_at)

  if (Number.isNaN(updatedAt)) {
    return null
  }

  return {
    lastUpdateTimestamp: updatedAt,
    id: data.cursor_id,
  }
}

async function updateResolutionCursor(cursor: ResolutionCursor) {
  try {
    const payload = {
      service_name: 'resolution_sync',
      subgraph_name: 'resolution',
      cursor_updated_at: BigInt(cursor.lastUpdateTimestamp),
      cursor_id: cursor.id,
    }

    await db
      .insert(subgraph_syncs)
      .values(payload)
      .onConflictDoUpdate({
        target: [subgraph_syncs.service_name, subgraph_syncs.subgraph_name],
        set: payload,
      })
  }
  catch (error) {
    console.error('Failed to update resolution cursor:', error)
  }
}

async function fetchResolutionPage(afterCursor: ResolutionCursor | null): Promise<{ resolutions: SubgraphResolution[] }> {
  const cursorTimestamp = afterCursor?.lastUpdateTimestamp
  const cursorId = afterCursor?.id

  let whereClause = ''
  if (cursorTimestamp !== undefined && cursorId) {
    const timestampLiteral = JSON.stringify(cursorTimestamp.toString())
    const idLiteral = JSON.stringify(cursorId)
    whereClause = `, where: { or: [{ lastUpdateTimestamp_gt: ${timestampLiteral} }, { lastUpdateTimestamp: ${timestampLiteral}, id_gt: ${idLiteral} }] }`
  }

  const query = `
    {
      marketResolutions(
        first: ${RESOLUTION_PAGE_SIZE},
        orderBy: lastUpdateTimestamp,
        orderDirection: asc${whereClause}
      ) {
        id
        status
        flagged
        paused
        wasDisputed
        approved
        lastUpdateTimestamp
        price
        liveness
      }
    }
  `

  const response = await fetch(RESOLUTION_SUBGRAPH_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Resolution subgraph request failed: ${response.statusText}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(`Resolution subgraph query error: ${result.errors[0].message}`)
  }

  const rawResolutions: SubgraphResolution[] = result.data.marketResolutions || []

  return {
    resolutions: rawResolutions.map(resolution => ({
      ...resolution,
      flagged: normalizeBooleanField(resolution.flagged),
      paused: normalizeBooleanField(resolution.paused),
      wasDisputed: normalizeBooleanField(resolution.wasDisputed),
      approved: resolution.approved == null ? null : normalizeBooleanField(resolution.approved),
    })),
  }
}

function normalizeBooleanField(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return Boolean(value)
}

async function processResolution(
  resolution: SubgraphResolution,
  conditionId: string,
  marketContext: MarketContext,
) {
  const lastUpdateTimestamp = Number(resolution.lastUpdateTimestamp)
  const lastUpdateIso = new Date(lastUpdateTimestamp * 1000).toISOString()
  const status = resolution.status?.toLowerCase() ?? 'posed'
  const isResolved = status === 'resolved'
  const resolutionPrice = normalizeResolutionPrice(resolution.price)
  const resolutionLivenessSeconds = normalizeResolutionLiveness(resolution.liveness)
  const deadlineAt = computeResolutionDeadline(
    status,
    resolution.flagged,
    lastUpdateTimestamp,
    resolutionLivenessSeconds,
    marketContext.negRisk,
  )
  const lastUpdateAt = new Date(lastUpdateIso)
  const deadlineAtDate = deadlineAt ? new Date(deadlineAt) : null

  await db
    .update(conditionsTable)
    .set({
      resolved: isResolved,
      resolution_status: status,
      resolution_flagged: resolution.flagged,
      resolution_paused: resolution.paused,
      resolution_last_update: lastUpdateAt,
      resolution_price: resolutionPrice == null ? null : String(resolutionPrice),
      resolution_was_disputed: resolution.wasDisputed,
      resolution_approved: resolution.approved ?? null,
      resolution_deadline_at: deadlineAtDate,
      resolution_liveness_seconds: resolutionLivenessSeconds,
    })
    .where(eq(conditionsTable.id, conditionId))

  const marketUpdate: Record<string, any> = isResolved
    ? {
        is_resolved: true,
        is_active: false,
      }
    : {
        is_resolved: false,
      }

  const marketWhere = isResolved
    ? and(
        eq(marketsTable.condition_id, conditionId),
        or(
          ne(marketsTable.is_resolved, true),
          isNull(marketsTable.is_resolved),
          ne(marketsTable.is_active, false),
          isNull(marketsTable.is_active),
        ),
      )
    : and(
        eq(marketsTable.condition_id, conditionId),
        or(
          ne(marketsTable.is_resolved, false),
          isNull(marketsTable.is_resolved),
        ),
      )

  await db
    .update(marketsTable)
    .set(marketUpdate)
    .where(marketWhere)

  if (isResolved && resolutionPrice != null) {
    await updateOutcomePayouts(conditionId, resolutionPrice)
  }

  return marketContext.eventId ?? null
}

function computeResolutionDeadline(
  status: string,
  flagged: boolean,
  lastUpdateTimestamp: number,
  livenessSeconds: number | null,
  negRisk: boolean,
): string | null {
  if (status === 'resolved') {
    return null
  }

  if (flagged) {
    const safetyPeriod = negRisk ? SAFETY_PERIOD_NEGRISK_SECONDS : SAFETY_PERIOD_V4_SECONDS
    return new Date((lastUpdateTimestamp + safetyPeriod) * 1000).toISOString()
  }

  if (status === 'posed' || status === 'proposed' || status === 'reproposed' || status === 'challenged' || status === 'disputed') {
    const effectiveLiveness = livenessSeconds ?? RESOLUTION_LIVENESS_DEFAULT_SECONDS
    if (effectiveLiveness == null) {
      return null
    }

    return new Date((lastUpdateTimestamp + effectiveLiveness) * 1000).toISOString()
  }

  return null
}

function normalizeResolutionLiveness(rawValue: string | null | undefined): number | null {
  if (!rawValue) {
    return null
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function normalizeResolutionPrice(rawValue: string | null): number | null {
  if (!rawValue) {
    return null
  }

  try {
    const value = BigInt(rawValue)
    if (value === RESOLUTION_UNPROPOSED_PRICE_SENTINEL) {
      return null
    }
    if (value < 0n) {
      return null
    }
    if (value === 0n) {
      return 0
    }
    if (value === RESOLUTION_PRICE_YES) {
      return 1
    }
    if (value === RESOLUTION_PRICE_INVALID) {
      return 0.5
    }
    return null
  }
  catch {
    return null
  }
}

async function updateOutcomePayouts(conditionId: string, price: number) {
  const payoutYes = price >= 1 ? 1 : price <= 0 ? 0 : price
  const payoutNo = price <= 0 ? 1 : price >= 1 ? 0 : price

  const updates = [
    { index: 0, payout: payoutYes },
    { index: 1, payout: payoutNo },
  ]

  for (const update of updates) {
    const isWinningOutcome = update.payout > 0
    await db
      .update(outcomesTable)
      .set({
        is_winning_outcome: isWinningOutcome,
        payout_value: String(update.payout),
      })
      .where(and(
        eq(outcomesTable.condition_id, conditionId),
        eq(outcomesTable.outcome_index, update.index),
        or(
          ne(outcomesTable.is_winning_outcome, isWinningOutcome),
          isNull(outcomesTable.is_winning_outcome),
          isNull(outcomesTable.payout_value),
          ne(outcomesTable.payout_value, String(update.payout)),
        ),
      ))
  }
}

async function updateEventStatusesFromMarketsBatch(eventIds: string[]) {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)))
  if (uniqueEventIds.length === 0) {
    return
  }
  const failedUpdates: string[] = []

  const [currentEvents, marketRows] = await Promise.all([
    db
      .select({
        id: eventsTable.id,
        status: eventsTable.status,
        resolved_at: eventsTable.resolved_at,
      })
      .from(eventsTable)
      .where(inArray(eventsTable.id, uniqueEventIds)),
    db
      .select({
        event_id: marketsTable.event_id,
        is_active: marketsTable.is_active,
        is_resolved: marketsTable.is_resolved,
      })
      .from(marketsTable)
      .where(inArray(marketsTable.event_id, uniqueEventIds)),
  ])

  const currentEventById = new Map(
    (currentEvents ?? []).map(event => [event.id, event]),
  )
  const countsByEventId = new Map<string, { total: number, active: number, unresolved: number }>()

  for (const eventId of uniqueEventIds) {
    countsByEventId.set(eventId, { total: 0, active: 0, unresolved: 0 })
  }

  for (const market of marketRows) {
    const eventId = market.event_id
    if (!eventId || !countsByEventId.has(eventId)) {
      continue
    }

    const bucket = countsByEventId.get(eventId)!
    bucket.total += 1

    const isActiveMarket = market.is_active === true
      || (market.is_active == null && market.is_resolved === false)
    if (isActiveMarket) {
      bucket.active += 1
    }

    const isUnresolvedMarket = market.is_resolved === false || market.is_resolved == null
    if (isUnresolvedMarket) {
      bucket.unresolved += 1
    }
  }

  for (const eventId of uniqueEventIds) {
    const currentEvent = currentEventById.get(eventId)
    if (!currentEvent) {
      continue
    }

    const counts = countsByEventId.get(eventId) ?? { total: 0, active: 0, unresolved: 0 }
    const hasMarkets = counts.total > 0
    const hasActiveMarket = counts.active > 0
    const hasUnresolvedMarket = counts.unresolved > 0

    const nextStatus: 'draft' | 'active' | 'resolved' | 'archived'
      = !hasMarkets
        ? 'draft'
        : !hasUnresolvedMarket
            ? 'resolved'
            : hasActiveMarket
              ? 'active'
              : 'archived'

    const shouldSetResolvedAt = nextStatus === 'resolved'
      && (currentEvent.resolved_at == null)
    const resolvedAtUpdate = shouldSetResolvedAt
      ? new Date()
      : nextStatus === 'resolved'
        ? currentEvent.resolved_at ?? null
        : null

    const currentResolvedAtIso = currentEvent.resolved_at?.toISOString() ?? null
    const nextResolvedAtIso = resolvedAtUpdate?.toISOString() ?? null
    if (currentEvent.status === nextStatus && currentResolvedAtIso === nextResolvedAtIso) {
      continue
    }

    try {
      await db
        .update(eventsTable)
        .set({ status: nextStatus, resolved_at: resolvedAtUpdate })
        .where(eq(eventsTable.id, eventId))
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to update event status for ${eventId}:`, error)
      failedUpdates.push(`${eventId}: ${message}`)
    }
  }

  if (failedUpdates.length > 0) {
    const sample = failedUpdates.slice(0, 3).join('; ')
    throw new Error(
      `Failed to update ${failedUpdates.length} event status record(s). Example failures: ${sample}`,
    )
  }
}
