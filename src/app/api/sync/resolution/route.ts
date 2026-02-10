import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

const RESOLUTION_SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmkeqj653po3801t6ajbv1wcv/subgraphs/resolution-subgraph/1.0.0/gn'
const SYNC_TIME_LIMIT_MS = 250_000
const RESOLUTION_PAGE_SIZE = 200
const SYNC_RUNNING_STALE_MS = 15 * 60 * 1000
const SAFETY_PERIOD_V4_SECONDS = 60 * 60
const SAFETY_PERIOD_NEGRISK_SECONDS = 2 * 24 * 60 * 60
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
  const staleThreshold = new Date(Date.now() - SYNC_RUNNING_STALE_MS).toISOString()
  const runningPayload = {
    service_name: 'resolution_sync',
    subgraph_name: 'resolution',
    status: 'running' as const,
    error_message: null,
  }

  // Atomic claim for existing row: only transitions to running when unlocked or stale.
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from('subgraph_syncs')
    .update(runningPayload)
    .eq('service_name', 'resolution_sync')
    .eq('subgraph_name', 'resolution')
    .or(`status.neq."running",updated_at.lt.${staleThreshold}`)
    .select('id')
    .limit(1)

  if (claimError) {
    if (isMissingColumnError(claimError, 'status')) {
      return tryAcquireLegacySyncLock()
    }
    throw new Error(`Failed to claim sync lock: ${claimError.message}`)
  }

  if ((claimedRows?.length ?? 0) > 0) {
    return true
  }

  // First run bootstrap path: create lock row as running.
  const { error: insertError } = await supabaseAdmin
    .from('subgraph_syncs')
    .insert(runningPayload)

  if (!insertError) {
    return true
  }

  // Unique key conflict means another worker claimed/created the lock first.
  if (insertError.code === '23505') {
    return false
  }

  throw new Error(`Failed to initialize sync lock: ${insertError.message}`)
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

  // Legacy fallback: keep the sync progressing even when status-based lock columns are not visible.
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from('subgraph_syncs')
    .update(legacyPayload)
    .eq('service_name', 'resolution_sync')
    .eq('subgraph_name', 'resolution')
    .select('id')
    .limit(1)

  if (updateError) {
    throw new Error(`Failed to claim legacy sync lock: ${updateError.message}`)
  }

  if ((updatedRows?.length ?? 0) > 0) {
    return true
  }

  const { error: insertError } = await supabaseAdmin
    .from('subgraph_syncs')
    .insert(legacyPayload)

  if (!insertError) {
    return true
  }

  if (insertError.code === '23505') {
    return false
  }

  throw new Error(`Failed to initialize legacy sync lock: ${insertError.message}`)
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

  const { error } = await supabaseAdmin
    .from('subgraph_syncs')
    .upsert(updateData, {
      onConflict: 'service_name,subgraph_name',
    })

  if (error) {
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
      const { data, error: conditionsError } = await supabaseAdmin
        .from('conditions')
        .select('id,question_id')
        .in('question_id', resolutionIds)

      if (conditionsError) {
        throw new Error(`Failed to load conditions: ${conditionsError.message}`)
      }
      conditions = data ?? []
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
      const { data, error: negRiskLookupError } = await supabaseAdmin
        .from('markets')
        .select('condition_id,event_id,neg_risk,neg_risk_request_id')
        .in('neg_risk_request_id', resolutionIds)

      if (negRiskLookupError) {
        throw new Error(`Failed to load neg-risk request mappings: ${negRiskLookupError.message}`)
      }
      negRiskRequestMatches = data ?? []
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

    let markets: { condition_id: string, event_id: string | null, neg_risk: boolean | null }[] = []
    if (conditionIds.length > 0) {
      const { data, error: marketsError } = await supabaseAdmin
        .from('markets')
        .select('condition_id,event_id,neg_risk')
        .in('condition_id', conditionIds)

      if (marketsError) {
        throw new Error(`Failed to load markets: ${marketsError.message}`)
      }
      markets = data ?? []
    }

    const marketContextMap = new Map<string, MarketContext>()
    for (const market of markets) {
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
  const { data, error } = await supabaseAdmin
    .from('subgraph_syncs')
    .select('cursor_updated_at,cursor_id')
    .eq('service_name', 'resolution_sync')
    .eq('subgraph_name', 'resolution')
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load resolution cursor: ${error.message}`)
  }

  if (!data?.cursor_updated_at || !data?.cursor_id) {
    return null
  }

  const updatedAt = typeof data.cursor_updated_at === 'string'
    ? Number(data.cursor_updated_at)
    : Number(data.cursor_updated_at)

  if (Number.isNaN(updatedAt)) {
    return null
  }

  return {
    lastUpdateTimestamp: updatedAt,
    id: data.cursor_id,
  }
}

async function updateResolutionCursor(cursor: ResolutionCursor) {
  const { error } = await supabaseAdmin
    .from('subgraph_syncs')
    .upsert({
      service_name: 'resolution_sync',
      subgraph_name: 'resolution',
      cursor_updated_at: cursor.lastUpdateTimestamp,
      cursor_id: cursor.id,
    }, {
      onConflict: 'service_name,subgraph_name',
    })

  if (error) {
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

  const { error: conditionError } = await supabaseAdmin
    .from('conditions')
    .update({
      resolved: isResolved,
      resolution_status: status,
      resolution_flagged: resolution.flagged,
      resolution_paused: resolution.paused,
      resolution_last_update: lastUpdateIso,
      resolution_price: resolutionPrice,
      resolution_was_disputed: resolution.wasDisputed,
      resolution_approved: resolution.approved,
      resolution_deadline_at: deadlineAt,
      resolution_liveness_seconds: resolutionLivenessSeconds,
    })
    .eq('id', conditionId)

  if (conditionError) {
    throw new Error(`Failed to update condition ${conditionId}: ${conditionError.message}`)
  }

  const marketUpdate: Record<string, any> = {
    is_resolved: isResolved,
  }

  if (isResolved) {
    marketUpdate.is_active = false
  }

  const { error: marketError } = await supabaseAdmin
    .from('markets')
    .update(marketUpdate)
    .eq('condition_id', conditionId)

  if (marketError) {
    throw new Error(`Failed to update market ${conditionId}: ${marketError.message}`)
  }

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
    const { error } = await supabaseAdmin
      .from('outcomes')
      .update({
        is_winning_outcome: update.payout > 0,
        payout_value: update.payout,
      })
      .eq('condition_id', conditionId)
      .eq('outcome_index', update.index)

    if (error) {
      throw new Error(`Failed to update outcomes for ${conditionId}: ${error.message}`)
    }
  }
}

async function updateEventStatusesFromMarketsBatch(eventIds: string[]) {
  for (const eventId of eventIds) {
    await updateEventStatusFromMarkets(eventId)
  }
}

async function updateEventStatusFromMarkets(eventId: string) {
  const { data: currentEvent, error: currentEventError } = await supabaseAdmin
    .from('events')
    .select('status,resolved_at')
    .eq('id', eventId)
    .maybeSingle()

  if (currentEventError) {
    console.error(`Failed to load current status for event ${eventId}:`, currentEventError)
    return
  }

  const { count: totalCount, error: totalError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (totalError) {
    console.error(`Failed to compute market counts for event ${eventId}:`, totalError)
    return
  }

  const { count: activeCount, error: activeError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .or('is_active.eq.true,and(is_active.is.null,is_resolved.eq.false)')

  if (activeError) {
    console.error(`Failed to compute active market count for event ${eventId}:`, activeError)
    return
  }

  const { count: unresolvedCount, error: unresolvedError } = await supabaseAdmin
    .from('markets')
    .select('condition_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .or('is_resolved.eq.false,is_resolved.is.null')

  if (unresolvedError) {
    console.error(`Failed to compute unresolved market count for event ${eventId}:`, unresolvedError)
    return
  }

  const hasMarkets = (totalCount ?? 0) > 0
  const hasActiveMarket = (activeCount ?? 0) > 0
  const hasUnresolvedMarket = (unresolvedCount ?? 0) > 0

  const nextStatus: 'draft' | 'active' | 'resolved' | 'archived'
    = !hasMarkets
      ? 'draft'
      : !hasUnresolvedMarket
          ? 'resolved'
          : hasActiveMarket
            ? 'active'
            : 'archived'

  const shouldSetResolvedAt = nextStatus === 'resolved'
    && (currentEvent?.resolved_at == null)
  const resolvedAtUpdate = shouldSetResolvedAt
    ? new Date().toISOString()
    : nextStatus === 'resolved'
      ? currentEvent?.resolved_at ?? null
      : null

  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({ status: nextStatus, resolved_at: resolvedAtUpdate })
    .eq('id', eventId)

  if (updateError) {
    console.error(`Failed to update status for event ${eventId}:`, updateError)
  }
}
