import type { VolumeResponseItem, VolumeWorkItem } from '@/app/api/sync/volume/helpers'
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
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

const CLOB_URL = process.env.CLOB_URL!

interface VolumeSyncStats {
  scanned: number
  updated: number
  skipped: number
  errors: { context: string, error: string }[]
  timeLimitReached: boolean
}

interface MarketRow {
  condition_id: string
  volume_24h: string | null
  volume: string | null
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

  try {
    const stats = await syncMarketVolumes(request)
    return NextResponse.json({ success: true, ...stats })
  }
  catch (error: any) {
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
  const startedAt = Date.now()

  const worklist = await buildVolumeWorklist(limit)
  const stats: VolumeSyncStats = {
    scanned: worklist.scanned,
    updated: 0,
    skipped: worklist.skipped,
    errors: [...worklist.errors],
    timeLimitReached: false,
  }

  if (worklist.items.length === 0) {
    return stats
  }

  const batches = chunkVolumeWork(worklist.items, VOLUME_BATCH_SIZE)

  for (const batch of batches) {
    if (hasReachedTimeLimit(startedAt, Date.now(), SYNC_TIME_LIMIT_MS)) {
      stats.timeLimitReached = true
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
          continue
        }

        if (response.status !== 200) {
          stats.errors.push({
            context: `volume:${workItem.conditionId}`,
            error: response.error ?? `status_${response.status}`,
          })
          continue
        }

        if (response.volume == null) {
          stats.errors.push({ context: `volume:${workItem.conditionId}`, error: 'missing_volume_value' })
          continue
        }

        const totalVolume = normalizeVolumeValue(response.volume)
        const volume24h = normalizeVolumeValue(response.volume_24h ?? '0')
        const hasVolumeChanged
          = normalizeComparableDecimal(totalVolume) !== normalizeComparableDecimal(workItem.previousTotalVolume)
            || normalizeComparableDecimal(volume24h) !== normalizeComparableDecimal(workItem.previousVolume24h)

        if (!hasVolumeChanged) {
          stats.skipped++
          continue
        }

        try {
          await updateMarketVolume(workItem.conditionId, totalVolume, volume24h)
          stats.updated++
        }
        catch (error: any) {
          stats.errors.push({
            context: `update:${workItem.conditionId}`,
            error: error?.message ?? 'failed_to_update_market',
          })
        }
      }
    }
    catch (error: any) {
      const firstId = batch[0]?.conditionId ?? 'unknown'
      const lastId = batch[batch.length - 1]?.conditionId ?? 'unknown'
      stats.errors.push({
        context: `batch:${firstId}-${lastId}`,
        error: error?.message ?? 'volume_batch_failed',
      })
    }
  }

  return stats
}

async function buildVolumeWorklist(limit: number): Promise<{
  items: VolumeWorkItem[]
  scanned: number
  skipped: number
  errors: { context: string, error: string }[]
}> {
  const { data: markets, error: marketsError } = await supabaseAdmin
    .from('markets')
    .select('condition_id, volume_24h, volume')
    .eq('is_active', true)
    .eq('is_resolved', false)
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (marketsError) {
    throw new Error(`Failed to load markets: ${marketsError.message}`)
  }

  const marketRows: MarketRow[] = markets ?? []
  const conditionIds = marketRows.map(market => market.condition_id)

  let outcomesMap = new Map<string, string[]>()
  if (conditionIds.length > 0) {
    const { data: outcomes, error: outcomesError } = await supabaseAdmin
      .from('outcomes')
      .select('condition_id, token_id')
      .in('condition_id', conditionIds)

    if (outcomesError) {
      throw new Error(`Failed to load outcomes: ${outcomesError.message}`)
    }

    const outcomeRows: OutcomeRow[] = outcomes ?? []
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
      tokenIds: [uniqueTokens[0], uniqueTokens[1]],
      previousTotalVolume: market.volume ?? '0',
      previousVolume24h: market.volume_24h ?? '0',
    })
  }

  return {
    items,
    scanned: marketRows.length,
    skipped,
    errors,
  }
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
  const { error } = await supabaseAdmin
    .from('markets')
    .update({
      volume: totalVolume,
      volume_24h: volume24h,
    })
    .eq('condition_id', conditionId)

  if (error) {
    throw new Error(error.message)
  }
}
