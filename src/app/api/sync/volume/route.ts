import type { VolumeResponseItem, VolumeWorkItem } from '@/app/api/sync/volume/helpers'
import { and, asc, eq, gt, inArray, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import {
  chunkVolumeWork,
  DEFAULT_VOLUME_SYNC_LIMIT,
  hasReachedTimeLimit,
  MAX_VOLUME_SYNC_LIMIT,
  normalizeVolumeValue,
  parseLimitParam,
  SYNC_TIME_LIMIT_MS,
  VOLUME_BATCH_SIZE,
  VOLUME_REQUEST_TIMEOUT_MS,
} from '@/app/api/sync/volume/helpers'
import { isCronAuthorized } from '@/lib/auth-cron'
import { cacheTags } from '@/lib/cache-tags'
import { events, markets, outcomes, subgraph_syncs } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export const maxDuration = 300

const CLOB_URL = (process.env.CLOB_URL ?? 'https://clob.kuest.com').replace(/\/+$/, '')
const SYNC_RUNNING_STALE_MS = 15 * 60 * 1000
const VOLUME_SYNC_SERVICE = 'volume_sync'
const VOLUME_SYNC_SUBGRAPH = 'volume'
const ZERO_VOLUME_PRIORITY_LIMIT = 50

interface VolumeSyncStats {
  scanned: number
  updated: number
  skipped: number
  errors: { context: string, error: string }[]
  timeLimitReached: boolean
  nextCursor: string | null
  wrappedAround: boolean
  updatedEventSlugs: string[]
}

interface OutcomeRow {
  condition_id: string
  token_id: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!isCronAuthorized(authHeader, cronSecret)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  let lockAcquired = false

  try {
    lockAcquired = await tryAcquireSyncLock()
    if (!lockAcquired) {
      return NextResponse.json({
        success: false,
        message: 'Sync already running',
        skipped: true,
      }, { status: 409 })
    }

    const stats = await syncMarketVolumes(request)
    await updateSyncStatus('completed', null, stats.updated, stats.nextCursor)
    return NextResponse.json({ success: true, ...stats })
  }
  catch (error: any) {
    if (lockAcquired) {
      await updateSyncStatus('error', error?.message ?? 'Unknown error')
    }
    console.error('volume-sync failed', error)
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}

async function syncMarketVolumes(request: Request): Promise<VolumeSyncStats> {
  const url = new URL(request.url)
  const limit = parseLimitParam(
    url.searchParams.get('limit'),
    DEFAULT_VOLUME_SYNC_LIMIT,
    MAX_VOLUME_SYNC_LIMIT,
  )
  const cursorOverride = normalizeCursorParam(url.searchParams.get('cursor'))
  const currentCursor = cursorOverride ?? await getStoredCursor()
  const startedAt = Date.now()

  const worklist = await buildVolumeWorklist(limit, currentCursor)
  const stats: VolumeSyncStats = {
    scanned: worklist.scanned,
    updated: 0,
    skipped: worklist.skipped,
    errors: [...worklist.errors],
    timeLimitReached: false,
    nextCursor: worklist.nextCursor,
    wrappedAround: worklist.wrappedAround,
    updatedEventSlugs: [],
  }

  if (worklist.items.length === 0) {
    return stats
  }

  const batches = chunkVolumeWork(worklist.items, VOLUME_BATCH_SIZE)
  const updatedEventSlugs = new Set<string>()
  let lastCompletedCursor = currentCursor

  function markCursorItemAttempted(workItem: VolumeWorkItem) {
    if (!workItem.advancesCursor) {
      return
    }

    lastCompletedCursor = workItem.conditionId
  }

  for (const batch of batches) {
    if (hasReachedTimeLimit(startedAt, Date.now(), SYNC_TIME_LIMIT_MS)) {
      stats.timeLimitReached = true
      stats.nextCursor = lastCompletedCursor
      break
    }

    try {
      const responses = await fetchVolumeBatch(batch)
      const responseMap = new Map<string, VolumeResponseItem>()
      for (const item of responses) {
        responseMap.set(item.condition_id, item)
      }

      for (const workItem of batch) {
        const response = responseMap.get(workItem.conditionId)
        if (!response) {
          stats.errors.push({ context: `volume:${workItem.conditionId}`, error: 'missing_response' })
          markCursorItemAttempted(workItem)
          continue
        }

        if (response.status !== 200) {
          stats.errors.push({
            context: `volume:${workItem.conditionId}`,
            error: response.error ?? `status_${response.status}`,
          })
          markCursorItemAttempted(workItem)
          continue
        }

        if (response.volume == null) {
          stats.errors.push({ context: `volume:${workItem.conditionId}`, error: 'missing_volume_value' })
          markCursorItemAttempted(workItem)
          continue
        }

        const totalVolume = normalizeVolumeValue(response.volume)
        const volume24h = normalizeVolumeValue(response.volume_24h ?? '0')
        const hasVolumeChanged
          = normalizeComparableDecimal(totalVolume) !== normalizeComparableDecimal(workItem.previousTotalVolume)
            || normalizeComparableDecimal(volume24h) !== normalizeComparableDecimal(workItem.previousVolume24h)

        if (!hasVolumeChanged) {
          stats.skipped++
          markCursorItemAttempted(workItem)
          continue
        }

        try {
          await updateMarketVolume(workItem.conditionId, totalVolume, volume24h)
          stats.updated++
          updatedEventSlugs.add(workItem.eventSlug)
          markCursorItemAttempted(workItem)
        }
        catch (error: any) {
          stats.errors.push({
            context: `update:${workItem.conditionId}`,
            error: error?.message ?? 'failed_to_update_market',
          })
          markCursorItemAttempted(workItem)
        }
      }
    }
    catch (error: any) {
      const firstId = batch[0]?.conditionId ?? 'unknown'
      const lastId = batch.at(-1)?.conditionId ?? 'unknown'
      const message = error?.message ?? 'volume_batch_failed'
      stats.errors.push({
        context: `batch:${firstId}-${lastId}`,
        error: message,
      })
      stats.nextCursor = lastCompletedCursor
      break
    }
  }

  stats.updatedEventSlugs = Array.from(updatedEventSlugs)
  if (stats.updated > 0) {
    revalidateVolumeCaches(stats.updatedEventSlugs)
  }

  return stats
}

function normalizeCursorParam(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

async function buildVolumeWorklist(limit: number, cursor: string | null): Promise<{
  items: VolumeWorkItem[]
  scanned: number
  skipped: number
  errors: { context: string, error: string }[]
  nextCursor: string | null
  wrappedAround: boolean
}> {
  const priorityLimit = Math.min(Math.max(0, limit - 1), ZERO_VOLUME_PRIORITY_LIMIT)
  const priorityRows = await fetchZeroVolumeMarketRows(priorityLimit)
  let wrappedAround = false

  const priorityConditionIds = priorityRows.map(market => market.condition_id)
  const remainingLimit = Math.max(0, limit - priorityRows.length)
  let cursorRows = remainingLimit > 0
    ? await fetchMarketRows(remainingLimit, cursor, priorityConditionIds)
    : []

  if (cursorRows.length === 0 && cursor && remainingLimit > 0) {
    cursorRows = await fetchMarketRows(remainingLimit, null, priorityConditionIds)
    wrappedAround = true
  }

  const marketRows = [...priorityRows, ...cursorRows]
  const nextCursor = cursorRows.at(-1)?.condition_id ?? cursor
  const conditionIds = marketRows.map(market => market.condition_id)
  const cursorConditionIds = new Set(cursorRows.map(market => market.condition_id))

  let outcomesMap = new Map<string, string[]>()
  if (conditionIds.length > 0) {
    const outcomeRows = await db
      .select({
        condition_id: outcomes.condition_id,
        token_id: outcomes.token_id,
      })
      .from(outcomes)
      .where(inArray(outcomes.condition_id, conditionIds))

    outcomesMap = buildOutcomeMap(outcomeRows)
  }

  const errors: { context: string, error: string }[] = []
  let skipped = 0
  const items: VolumeWorkItem[] = []

  for (const market of marketRows) {
    const tokens = outcomesMap.get(market.condition_id) ?? []
    const uniqueTokens = Array.from(new Set(tokens))

    if (uniqueTokens.length !== 2) {
      skipped++
      const errorCode = uniqueTokens.length === 0 ? 'missing_outcomes' : 'invalid_outcome_count'
      errors.push({ context: `market:${market.condition_id}`, error: errorCode })
      continue
    }

    items.push({
      conditionId: market.condition_id,
      eventSlug: market.event_slug,
      tokenIds: [uniqueTokens[0], uniqueTokens[1]],
      previousTotalVolume: market.volume ?? '0',
      previousVolume24h: market.volume_24h ?? '0',
      advancesCursor: cursorConditionIds.has(market.condition_id),
    })
  }

  return {
    items,
    scanned: marketRows.length,
    skipped,
    errors,
    nextCursor,
    wrappedAround,
  }
}

function buildBaseMarketPredicate(excludedConditionIds: string[] = []) {
  const predicates = [
    eq(markets.is_active, true),
    eq(markets.is_resolved, false),
  ]

  if (excludedConditionIds.length > 0) {
    predicates.push(notInArray(markets.condition_id, excludedConditionIds))
  }

  return and(...predicates)
}

async function fetchZeroVolumeMarketRows(limit: number) {
  if (limit <= 0) {
    return []
  }

  const basePredicate = buildBaseMarketPredicate()

  return db
    .select({
      condition_id: markets.condition_id,
      event_slug: events.slug,
      volume_24h: markets.volume_24h,
      volume: markets.volume,
    })
    .from(markets)
    .innerJoin(events, eq(events.id, markets.event_id))
    .where(and(
      basePredicate,
      sql`${markets.volume} = 0`,
    ))
    .orderBy(asc(markets.condition_id))
    .limit(limit)
}

async function fetchMarketRows(limit: number, cursor: string | null, excludedConditionIds: string[] = []) {
  if (limit <= 0) {
    return []
  }

  const basePredicate = buildBaseMarketPredicate(excludedConditionIds)
  const predicate = cursor
    ? and(basePredicate, gt(markets.condition_id, cursor))
    : basePredicate

  return db
    .select({
      condition_id: markets.condition_id,
      event_slug: events.slug,
      volume_24h: markets.volume_24h,
      volume: markets.volume,
    })
    .from(markets)
    .innerJoin(events, eq(events.id, markets.event_id))
    .where(predicate)
    .orderBy(asc(markets.condition_id))
    .limit(limit)
}

function buildOutcomeMap(outcomes: OutcomeRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const outcome of outcomes) {
    const list = map.get(outcome.condition_id) ?? []
    list.push(outcome.token_id)
    map.set(outcome.condition_id, list)
  }
  return map
}

function normalizeComparableDecimal(value: string) {
  const normalized = normalizeVolumeValue(value).trim()
  if (!normalized) {
    return '0'
  }

  const withoutSign = normalized.startsWith('-') ? normalized.slice(1) : normalized
  const [integerPartRaw, fractionalPartRaw = ''] = withoutSign.split('.')
  const integerPart = (integerPartRaw || '0').replace(/^0+(?=\d)/, '') || '0'
  const fractionalPart = fractionalPartRaw.replace(/0+$/, '')
  const base = fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart

  return normalized.startsWith('-') && base !== '0' ? `-${base}` : base
}

async function fetchVolumeBatch(batch: VolumeWorkItem[]): Promise<VolumeResponseItem[]> {
  if (batch.length === 0) {
    return []
  }

  const payload = {
    include_24h: true,
    conditions: batch.map(item => ({
      condition_id: item.conditionId,
      token_ids: item.tokenIds,
    })),
  }

  const response = await fetch(`${CLOB_URL}/data/volumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(VOLUME_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`CLOB volume request failed with status ${response.status}`)
  }

  const body = await response.json()
  if (!Array.isArray(body)) {
    throw new TypeError('Unexpected volume response shape')
  }

  return body as VolumeResponseItem[]
}

async function updateMarketVolume(conditionId: string, totalVolume: string, volume24h: string) {
  await db
    .update(markets)
    .set({
      volume: totalVolume,
      volume_24h: volume24h,
    })
    .where(eq(markets.condition_id, conditionId))
}

function revalidateVolumeCaches(eventSlugs: string[]) {
  revalidateTag(cacheTags.eventsList, 'max')

  for (const slug of eventSlugs) {
    revalidateTag(cacheTags.event(slug), 'max')
  }
}

async function getStoredCursor(): Promise<string | null> {
  const rows = await db
    .select({
      cursor_id: subgraph_syncs.cursor_id,
    })
    .from(subgraph_syncs)
    .where(and(
      eq(subgraph_syncs.service_name, VOLUME_SYNC_SERVICE),
      eq(subgraph_syncs.subgraph_name, VOLUME_SYNC_SUBGRAPH),
    ))
    .limit(1)

  if (rows.length === 0) {
    throw new Error('Missing sync state row for volume_sync/volume. Run the latest database migrations.')
  }

  return rows[0]?.cursor_id ?? null
}

async function tryAcquireSyncLock(): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - SYNC_RUNNING_STALE_MS)
  const runningPayload = {
    service_name: VOLUME_SYNC_SERVICE,
    subgraph_name: VOLUME_SYNC_SUBGRAPH,
    status: 'running' as const,
    error_message: null,
  }

  try {
    const claimedRows = await db
      .update(subgraph_syncs)
      .set(runningPayload)
      .where(and(
        eq(subgraph_syncs.service_name, VOLUME_SYNC_SERVICE),
        eq(subgraph_syncs.subgraph_name, VOLUME_SYNC_SUBGRAPH),
        or(
          ne(subgraph_syncs.status, 'running'),
          lt(subgraph_syncs.updated_at, staleThreshold),
        ),
      ))
      .returning({ id: subgraph_syncs.id })

    if (claimedRows.length > 0) {
      return true
    }

    const existingRows = await db
      .select({ id: subgraph_syncs.id })
      .from(subgraph_syncs)
      .where(and(
        eq(subgraph_syncs.service_name, VOLUME_SYNC_SERVICE),
        eq(subgraph_syncs.subgraph_name, VOLUME_SYNC_SUBGRAPH),
      ))
      .limit(1)

    if (existingRows.length > 0) {
      return false
    }

    throw new Error('Missing sync state row for volume_sync/volume. Run the latest database migrations.')
  }
  catch (error: any) {
    throw new Error(`Failed to claim sync lock: ${error?.message ?? String(error)}`)
  }
}

async function updateSyncStatus(
  status: 'running' | 'completed' | 'error',
  errorMessage?: string | null,
  totalProcessed?: number,
  cursorId?: string | null,
) {
  const updateData: any = {
    service_name: VOLUME_SYNC_SERVICE,
    subgraph_name: VOLUME_SYNC_SUBGRAPH,
    status,
  }

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage
  }

  if (totalProcessed !== undefined) {
    updateData.total_processed = totalProcessed
  }

  if (cursorId !== undefined) {
    updateData.cursor_id = cursorId
  }

  try {
    const updatedRows = await db
      .update(subgraph_syncs)
      .set(updateData)
      .where(and(
        eq(subgraph_syncs.service_name, VOLUME_SYNC_SERVICE),
        eq(subgraph_syncs.subgraph_name, VOLUME_SYNC_SUBGRAPH),
      ))
      .returning({ id: subgraph_syncs.id })

    if (updatedRows.length === 0) {
      console.error('Failed to update sync status: missing sync state row for volume_sync/volume')
    }
  }
  catch (error: any) {
    console.error(`Failed to update sync status to ${status}:`, error)
  }
}
