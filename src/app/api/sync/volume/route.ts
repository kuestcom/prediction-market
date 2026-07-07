import type { VolumeJobRow, VolumeResponseItem } from '@/app/api/sync/volume/helpers'
import { and, asc, eq, lte, or, sql } from 'drizzle-orm'
import {
  buildVolumeJobRetryAt,
  normalizeVolumeValue,
  parseVolumeJobPayload,
  truncateVolumeJobError,
  VOLUME_JOB_PROCESS_CONCURRENCY,
  VOLUME_JOB_PROCESS_LIMIT,
  VOLUME_JOB_PROCESSING_STALE_MS,
  VOLUME_JOB_REQUEST_TIMEOUT_MS,
  VOLUME_SYNC_JOB_TYPE,
} from '@/app/api/sync/volume/helpers'
import { events, jobs, markets, outcomes } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { buildCronJsonResponse, handleCronRoute } from '@/lib/sync/cron-route'

export const maxDuration = 60

interface VolumeJobStats {
  claimed: number
  reclaimed: number
  claimFailed: number
  completed: number
  updated: number
  skipped: number
  retried: number
  failed: number
  leaseLost: number
  errors: { jobId: string, conditionId: string | null, error: string }[]
  updatedEventSlugs: string[]
}

interface MarketVolumeTarget {
  event_slug: string
  is_active: boolean
  is_resolved: boolean
  volume: string
  volume_24h: string
}

interface ProcessVolumeJobResult {
  conditionId: string
  eventSlug: string | null
  status: 'updated' | 'skipped'
  reason?: string
}

interface VolumeJobOutcome {
  jobId: string
  conditionId: string | null
  eventSlug: string | null
  status: 'updated' | 'skipped' | 'retried' | 'failed' | 'lease_lost'
  error?: string
}

export async function GET(request: Request) {
  return handleCronRoute({
    request,
    jobName: 'volume-job-worker',
    handler: async () => {
      const now = new Date()
      const processingStaleThreshold = new Date(now.getTime() - VOLUME_JOB_PROCESSING_STALE_MS)
      const claimableJobs = await loadClaimableJobs(now, processingStaleThreshold, VOLUME_JOB_PROCESS_LIMIT)
      const stats: VolumeJobStats = {
        claimed: 0,
        reclaimed: 0,
        completed: 0,
        updated: 0,
        skipped: 0,
        retried: 0,
        failed: 0,
        leaseLost: 0,
        claimFailed: 0,
        errors: [],
        updatedEventSlugs: [],
      }
      const updatedEventSlugs = new Set<string>()
      const claimStartedAt = new Date()
      const claimOutcomes = await Promise.allSettled(
        claimableJobs.map(claimableJob => claimJob(claimableJob, claimStartedAt, processingStaleThreshold)),
      )
      const claimedJobs: VolumeJobRow[] = []

      for (let index = 0; index < claimOutcomes.length; index += 1) {
        const outcome = claimOutcomes[index]
        const claimableJob = claimableJobs[index]!

        if (outcome.status === 'fulfilled') {
          if (outcome.value) {
            claimedJobs.push(outcome.value)
            if (claimableJob?.status === 'processing') {
              stats.reclaimed++
            }
          }
          continue
        }

        stats.claimFailed++
        const payload = safeParseVolumeJobPayload(claimableJob)
        stats.errors.push({
          jobId: claimableJob.id,
          conditionId: payload?.conditionId ?? null,
          error: `claim_failed: ${truncateVolumeJobError(outcome.reason)}`,
        })
      }

      stats.claimed = claimedJobs.length

      const outcomes = await settleWithConcurrency(
        claimedJobs,
        VOLUME_JOB_PROCESS_CONCURRENCY,
        processVolumeJob,
      )

      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') {
          stats.failed++
          stats.errors.push({
            jobId: 'unknown',
            conditionId: null,
            error: truncateVolumeJobError(outcome.reason),
          })
          continue
        }

        const result = outcome.value
        if (result.status === 'updated') {
          stats.completed++
          stats.updated++
          if (result.eventSlug) {
            updatedEventSlugs.add(result.eventSlug)
          }
          continue
        }

        if (result.status === 'skipped') {
          stats.completed++
          stats.skipped++
          continue
        }

        if (result.status === 'failed') {
          stats.failed++
        }
        else if (result.status === 'lease_lost') {
          stats.leaseLost++
        }
        else {
          stats.retried++
        }

        stats.errors.push({
          jobId: result.jobId,
          conditionId: result.conditionId,
          error: result.error ?? 'Unknown volume sync error',
        })
      }

      stats.updatedEventSlugs = Array.from(updatedEventSlugs)

      return { success: true, ...stats }
    },
    onError: error => buildCronJsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    ),
  })
}

async function processVolumeJob(job: VolumeJobRow): Promise<VolumeJobOutcome> {
  try {
    const result = await processClaimedJob(job)
    const completed = await completeJob(job)
    if (!completed) {
      return {
        jobId: job.id,
        conditionId: result.conditionId,
        eventSlug: result.eventSlug,
        status: 'lease_lost',
        error: 'lease_lost_after_success',
      }
    }

    return {
      jobId: job.id,
      conditionId: result.conditionId,
      eventSlug: result.eventSlug,
      status: result.status,
    }
  }
  catch (error) {
    const payload = safeParseVolumeJobPayload(job)
    let retryResult: Awaited<ReturnType<typeof scheduleRetry>>
    try {
      retryResult = await scheduleRetry(job, error)
    }
    catch (retryError) {
      return {
        jobId: job.id,
        conditionId: payload?.conditionId ?? null,
        eventSlug: null,
        status: 'failed',
        error: `${truncateVolumeJobError(error)}; retry update failed: ${truncateVolumeJobError(retryError)}`,
      }
    }

    if (!retryResult.applied) {
      return {
        jobId: job.id,
        conditionId: payload?.conditionId ?? null,
        eventSlug: null,
        status: 'lease_lost',
        error: `lease_lost_after_error: ${truncateVolumeJobError(error)}`,
      }
    }

    return {
      jobId: job.id,
      conditionId: payload?.conditionId ?? null,
      eventSlug: null,
      status: retryResult.exhausted ? 'failed' : 'retried',
      error: truncateVolumeJobError(error),
    }
  }
}

async function loadClaimableJobs(now: Date, processingStaleThreshold: Date, limit: number) {
  if (limit <= 0) {
    return []
  }

  const rows = await db
    .select({
      id: jobs.id,
      job_type: jobs.job_type,
      dedupe_key: jobs.dedupe_key,
      payload: jobs.payload,
      status: jobs.status,
      attempts: jobs.attempts,
      max_attempts: jobs.max_attempts,
      available_at: jobs.available_at,
      reserved_at: jobs.reserved_at,
    })
    .from(jobs)
    .where(and(
      eq(jobs.job_type, VOLUME_SYNC_JOB_TYPE),
      buildClaimableJobStatusCondition(now, processingStaleThreshold),
    ))
    .orderBy(
      sql`CASE WHEN ${jobs.status} = 'processing' THEN 0 ELSE 1 END`,
      asc(jobs.available_at),
      asc(jobs.updated_at),
    )
    .limit(limit)

  return rows as VolumeJobRow[]
}

async function claimJob(job: VolumeJobRow, now: Date, processingStaleThreshold: Date) {
  const claimed = await db
    .update(jobs)
    .set({
      status: 'processing',
      reserved_at: now,
      last_error: null,
    })
    .where(and(
      eq(jobs.id, job.id),
      buildClaimableJobStatusCondition(now, processingStaleThreshold),
    ))
    .returning({
      id: jobs.id,
      job_type: jobs.job_type,
      dedupe_key: jobs.dedupe_key,
      payload: jobs.payload,
      status: jobs.status,
      attempts: jobs.attempts,
      max_attempts: jobs.max_attempts,
      available_at: jobs.available_at,
      reserved_at: jobs.reserved_at,
    })

  return (claimed[0] as VolumeJobRow | undefined) ?? null
}

async function completeJob(job: VolumeJobRow) {
  if (!job.reserved_at) {
    return false
  }

  const completed = await db
    .update(jobs)
    .set({
      status: 'completed',
      attempts: (job.attempts ?? 0) + 1,
      reserved_at: null,
      last_error: null,
      available_at: new Date(),
    })
    .where(buildActiveLeaseCondition(job, job.reserved_at))
    .returning({ id: jobs.id })

  return completed.length > 0
}

async function scheduleRetry(job: VolumeJobRow, error: unknown) {
  if (!job.reserved_at) {
    return { exhausted: false, applied: false }
  }

  const attempts = (job.attempts ?? 0) + 1
  const exhausted = attempts >= (job.max_attempts ?? 5)

  const retried = await db
    .update(jobs)
    .set({
      status: exhausted ? 'failed' : 'pending',
      attempts,
      available_at: exhausted ? new Date() : buildVolumeJobRetryAt(attempts),
      reserved_at: null,
      last_error: truncateVolumeJobError(error),
    })
    .where(buildActiveLeaseCondition(job, job.reserved_at))
    .returning({ id: jobs.id })

  return { exhausted, applied: retried.length > 0 }
}

async function processClaimedJob(job: VolumeJobRow): Promise<ProcessVolumeJobResult> {
  const { conditionId } = parseVolumeJobPayload(job.payload, job.dedupe_key)
  const market = await loadMarketVolumeTarget(conditionId)
  if (!market) {
    return { conditionId, eventSlug: null, status: 'skipped', reason: 'market_not_found' }
  }

  if (!market.is_active || market.is_resolved) {
    return { conditionId, eventSlug: market.event_slug, status: 'skipped', reason: 'market_not_syncable' }
  }

  const tokenIds = await loadMarketOutcomeTokenIds(conditionId)
  if (tokenIds.length !== 2) {
    return { conditionId, eventSlug: market.event_slug, status: 'skipped', reason: 'invalid_outcome_count' }
  }

  const nextVolume = await fetchMarketVolume(conditionId, [tokenIds[0], tokenIds[1]])
  const hasVolumeChanged
    = normalizeComparableDecimal(nextVolume.totalVolume) !== normalizeComparableDecimal(market.volume)
      || normalizeComparableDecimal(nextVolume.volume24h) !== normalizeComparableDecimal(market.volume_24h)

  if (!hasVolumeChanged) {
    return { conditionId, eventSlug: market.event_slug, status: 'skipped', reason: 'unchanged' }
  }

  await db
    .update(markets)
    .set({
      volume: nextVolume.totalVolume,
      volume_24h: nextVolume.volume24h,
      updated_at: new Date(),
    })
    .where(eq(markets.condition_id, conditionId))

  return { conditionId, eventSlug: market.event_slug, status: 'updated' }
}

async function loadMarketVolumeTarget(conditionId: string): Promise<MarketVolumeTarget | null> {
  const rows = await db
    .select({
      event_slug: events.slug,
      is_active: markets.is_active,
      is_resolved: markets.is_resolved,
      volume: markets.volume,
      volume_24h: markets.volume_24h,
    })
    .from(markets)
    .innerJoin(events, eq(events.id, markets.event_id))
    .where(eq(markets.condition_id, conditionId))
    .limit(1)

  return (rows[0] as MarketVolumeTarget | undefined) ?? null
}

async function loadMarketOutcomeTokenIds(conditionId: string) {
  const rows = await db
    .select({
      token_id: outcomes.token_id,
    })
    .from(outcomes)
    .where(eq(outcomes.condition_id, conditionId))
    .orderBy(asc(outcomes.outcome_index))

  return Array.from(new Set(rows.map(row => row.token_id).filter(Boolean)))
}

async function fetchMarketVolume(conditionId: string, tokenIds: [string, string]) {
  const { clobUrl } = resolvePublicRuntimeEnv(process.env)

  const response = await fetch(`${clobUrl}/data/volumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      include_24h: true,
      conditions: [{
        condition_id: conditionId,
        token_ids: tokenIds,
      }],
    }),
    signal: AbortSignal.timeout(VOLUME_JOB_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`CLOB volume request failed with status ${response.status}`)
  }

  const body = await response.json()
  if (!Array.isArray(body)) {
    throw new TypeError('Unexpected volume response shape')
  }

  const item = body.find(candidate => isVolumeResponseItem(candidate) && candidate.condition_id === conditionId)
  if (!item || !isVolumeResponseItem(item)) {
    throw new Error('missing_volume_response')
  }

  if (item.status !== 200) {
    throw new Error(item.error ?? `status_${item.status}`)
  }

  if (item.volume == null) {
    throw new Error('missing_volume_value')
  }

  return {
    totalVolume: normalizeVolumeValue(item.volume),
    volume24h: normalizeVolumeValue(item.volume_24h ?? '0'),
  }
}

function isVolumeResponseItem(value: unknown): value is VolumeResponseItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<VolumeResponseItem>
  return typeof candidate.condition_id === 'string'
    && typeof candidate.status === 'number'
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

function safeParseVolumeJobPayload(job: VolumeJobRow) {
  try {
    return parseVolumeJobPayload(job.payload, job.dedupe_key)
  }
  catch {
    return null
  }
}

function buildClaimableJobStatusCondition(now: Date, processingStaleThreshold: Date) {
  return or(
    and(
      eq(jobs.status, 'pending'),
      lte(jobs.available_at, now),
    ),
    and(
      eq(jobs.status, 'processing'),
      lte(jobs.reserved_at, processingStaleThreshold),
    ),
  )
}

function buildActiveLeaseCondition(job: VolumeJobRow, reservedAt: Date) {
  return and(
    eq(jobs.id, job.id),
    eq(jobs.status, 'processing'),
    eq(jobs.reserved_at, reservedAt),
  )
}

async function settleWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<TResult>,
): Promise<Array<PromiseSettledResult<TResult>>> {
  const results: Array<PromiseSettledResult<TResult>> = Array.from({ length: items.length })
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1

      try {
        results[currentIndex] = {
          status: 'fulfilled',
          value: await task(items[currentIndex]!),
        }
      }
      catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return results
}
