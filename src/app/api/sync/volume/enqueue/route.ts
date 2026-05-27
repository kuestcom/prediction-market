import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import {
  buildVolumeJobDedupeKey,
  buildVolumeJobDedupeKeySql,
  VOLUME_JOB_ENQUEUE_LIMIT,
  VOLUME_JOB_FAILED_REFRESH_INTERVAL_MS,
  VOLUME_JOB_MAX_ATTEMPTS,
  VOLUME_JOB_REFRESH_INTERVAL_MS,
  VOLUME_SYNC_JOB_TYPE,
} from '@/app/api/sync/volume/helpers'
import { isCronAuthorized } from '@/lib/auth-cron'
import { jobs, markets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export const maxDuration = 60

interface VolumeJobUpsertRow {
  job_type: typeof VOLUME_SYNC_JOB_TYPE
  dedupe_key: string
  payload: { conditionId: string }
  status: 'pending'
  attempts: number
  max_attempts: number
  available_at: Date
  reserved_at: null
  last_error: null
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!isCronAuthorized(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const refreshThreshold = new Date(Date.now() - VOLUME_JOB_REFRESH_INTERVAL_MS)
    const failedRefreshThreshold = new Date(Date.now() - VOLUME_JOB_FAILED_REFRESH_INTERVAL_MS)
    const marketRows = await loadVolumeJobCandidates(VOLUME_JOB_ENQUEUE_LIMIT, refreshThreshold, failedRefreshThreshold)
    const rows = buildVolumeJobRows(marketRows)
    const enqueued = await upsertVolumeJobs(rows, refreshThreshold, failedRefreshThreshold)

    return NextResponse.json({
      success: true,
      scanned: marketRows.length,
      enqueued,
    })
  }
  catch (error: any) {
    console.error('volume-job-enqueue failed', error)
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}

async function loadVolumeJobCandidates(limit: number, refreshThreshold: Date, failedRefreshThreshold: Date) {
  if (limit <= 0) {
    return []
  }

  return db
    .select({
      condition_id: markets.condition_id,
    })
    .from(markets)
    .leftJoin(jobs, and(
      eq(jobs.job_type, VOLUME_SYNC_JOB_TYPE),
      eq(jobs.dedupe_key, buildVolumeJobDedupeKeySql(markets.condition_id)),
    ))
    .where(and(
      eq(markets.is_active, true),
      eq(markets.is_resolved, false),
      or(
        isNull(jobs.id),
        and(
          eq(jobs.status, 'completed'),
          lt(jobs.updated_at, refreshThreshold),
        ),
        and(
          eq(jobs.status, 'failed'),
          lt(jobs.updated_at, failedRefreshThreshold),
        ),
      ),
    ))
    .orderBy(
      sql`COALESCE(${jobs.updated_at}, to_timestamp(0)) ASC`,
      sql`CASE WHEN ${markets.volume} = 0 THEN 0 ELSE 1 END`,
      asc(markets.condition_id),
    )
    .limit(limit)
}

function buildVolumeJobRows(marketRows: Array<{ condition_id: string }>): VolumeJobUpsertRow[] {
  const now = new Date()
  const rows: VolumeJobUpsertRow[] = []

  for (const market of marketRows) {
    const dedupeKey = buildVolumeJobDedupeKey(market.condition_id)
    rows.push({
      job_type: VOLUME_SYNC_JOB_TYPE,
      dedupe_key: dedupeKey,
      payload: { conditionId: market.condition_id },
      status: 'pending',
      attempts: 0,
      max_attempts: VOLUME_JOB_MAX_ATTEMPTS,
      available_at: now,
      reserved_at: null,
      last_error: null,
    })
  }

  return rows
}

async function upsertVolumeJobs(
  rows: VolumeJobUpsertRow[],
  refreshThreshold: Date,
  failedRefreshThreshold: Date,
) {
  if (rows.length === 0) {
    return 0
  }

  const affectedRows = await db
    .insert(jobs)
    .values(rows)
    .onConflictDoUpdate({
      target: [jobs.job_type, jobs.dedupe_key],
      set: {
        payload: sql`excluded.payload`,
        status: sql`excluded.status`,
        attempts: sql`excluded.attempts`,
        max_attempts: sql`excluded.max_attempts`,
        available_at: sql`excluded.available_at`,
        reserved_at: sql`excluded.reserved_at`,
        last_error: sql`excluded.last_error`,
      },
      setWhere: sql`(
        (${jobs.status} = 'completed' AND ${jobs.updated_at} < ${refreshThreshold.toISOString()}::timestamptz)
        OR (${jobs.status} = 'failed' AND ${jobs.updated_at} < ${failedRefreshThreshold.toISOString()}::timestamptz)
      )`,
    })
    .returning({ id: jobs.id })

  return affectedRows.length
}
