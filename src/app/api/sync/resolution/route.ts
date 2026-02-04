import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

const RESOLUTION_SUBGRAPH_URL = process.env.RESOLUTION_SUBGRAPH_URL
const SYNC_TIME_LIMIT_MS = 250_000
const RESOLUTION_PAGE_SIZE = 200
const SAFETY_PERIOD_SECONDS = 60 * 60
const RESOLUTION_LIVENESS_DEFAULT_SECONDS = parseOptionalInt(process.env.RESOLUTION_LIVENESS_DEFAULT_SECONDS)

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

  if (!RESOLUTION_SUBGRAPH_URL) {
    return NextResponse.json({ error: 'RESOLUTION_SUBGRAPH_URL is required.' }, { status: 500 })
  }

  try {
    const isRunning = await checkSyncRunning()
    if (isRunning) {
      return NextResponse.json({
        success: false,
        message: 'Sync already running',
        skipped: true,
      }, { status: 409 })
    }

    await updateSyncStatus('running')

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

async function checkSyncRunning(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('subgraph_syncs')
    .select('status')
    .eq('service_name', 'resolution_sync')
    .eq('subgraph_name', 'resolution')
    .eq('status', 'running')
    .gt('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check sync status: ${error.message}`)
  }

  return Boolean(data)
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

    const questionIds = page.resolutions.map(resolution => resolution.id.toLowerCase())
    const { data: conditions, error: conditionsError } = await supabaseAdmin
      .from('conditions')
      .select('id,question_id')
      .in('question_id', questionIds)

    if (conditionsError) {
      throw new Error(`Failed to load conditions: ${conditionsError.message}`)
    }

    const conditionMap = new Map<string, { id: string, question_id: string }>()
    for (const condition of conditions ?? []) {
      if (condition.question_id) {
        conditionMap.set(condition.question_id.toLowerCase(), condition)
      }
    }

    const conditionIds = Array.from(conditionMap.values()).map(condition => condition.id)
    const { data: markets, error: marketsError } = await supabaseAdmin
      .from('markets')
      .select('condition_id,event_id')
      .in('condition_id', conditionIds)

    if (marketsError) {
      throw new Error(`Failed to load markets: ${marketsError.message}`)
    }

    const marketEventMap = new Map<string, string | null>()
    for (const market of markets ?? []) {
      marketEventMap.set(market.condition_id, market.event_id ?? null)
    }

    let lastCursor: ResolutionCursor | null = null

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

      lastCursor = {
        lastUpdateTimestamp,
        id: resolution.id,
      }

      const condition = conditionMap.get(resolution.id.toLowerCase())
      if (!condition) {
        skippedCount++
        continue
      }

      try {
        const eventId = await processResolution(
          resolution,
          condition.id,
          marketEventMap.get(condition.id) ?? null,
        )
        if (eventId) {
          eventIdsNeedingStatusUpdate.add(eventId)
        }
        processedCount++
      }
      catch (error: any) {
        errors.push({
          questionId: resolution.id,
          error: error.message ?? String(error),
        })
      }
    }

    if (lastCursor) {
      await updateResolutionCursor(lastCursor)
      cursor = lastCursor
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
  eventId: string | null,
) {
  const lastUpdateTimestamp = Number(resolution.lastUpdateTimestamp)
  const lastUpdateIso = new Date(lastUpdateTimestamp * 1000).toISOString()
  const status = resolution.status?.toLowerCase() ?? 'posed'
  const isResolved = status === 'resolved'
  const resolutionPrice = normalizeResolutionPrice(resolution.price)
  const deadlineAt = computeResolutionDeadline(status, resolution.flagged, lastUpdateTimestamp)

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

  return eventId ?? null
}

function computeResolutionDeadline(status: string, flagged: boolean, lastUpdateTimestamp: number): string | null {
  if (flagged) {
    return new Date((lastUpdateTimestamp + SAFETY_PERIOD_SECONDS) * 1000).toISOString()
  }

  if (status === 'proposed' || status === 'reproposed' || status === 'challenged' || status === 'disputed') {
    if (RESOLUTION_LIVENESS_DEFAULT_SECONDS == null) {
      return null
    }

    return new Date((lastUpdateTimestamp + RESOLUTION_LIVENESS_DEFAULT_SECONDS) * 1000).toISOString()
  }

  return null
}

function normalizeResolutionPrice(rawValue: string | null): number | null {
  if (!rawValue) {
    return null
  }

  try {
    const value = BigInt(rawValue)
    if (value === 0n) {
      return 0
    }
    if (value === 1000000000000000000n) {
      return 1
    }
    if (value === 500000000000000000n) {
      return 0.5
    }
    return Number(value) / 1e18
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
