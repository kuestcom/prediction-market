import { and, eq, lt, ne, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { subgraph_syncs } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

const DEFAULT_SYNC_RUNNING_STALE_MS = 15 * 60 * 1000

type SyncStatus = 'running' | 'completed' | 'error'

interface SyncStateKey {
  serviceName: string
  subgraphName: string
}

interface UpdateSyncStatusParams extends SyncStateKey {
  status: SyncStatus
  errorMessage?: string | null
  totalProcessed?: number
}

interface HandleCronRouteOptions<TPayload> {
  request: Request
  jobName: string
  handler: () => Promise<TPayload | Response>
  onError?: (error: unknown) => Promise<TPayload | Response> | TPayload | Response
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function toCronResponse<TPayload>(payload: TPayload | Response) {
  if (payload instanceof Response) {
    return payload
  }

  return NextResponse.json(payload)
}

export async function handleCronRoute<TPayload>({
  request,
  jobName,
  handler,
  onError,
}: HandleCronRouteOptions<TPayload>) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    return toCronResponse(await handler())
  }
  catch (error) {
    console.error(`${jobName} failed`, error)

    if (onError) {
      try {
        return toCronResponse(await onError(error))
      }
      catch (recoveryError) {
        console.error(`${jobName} error handler failed`, recoveryError)
        return buildCronErrorResponse(error)
      }
    }

    return NextResponse.json({
      success: false,
      error: getErrorMessage(error),
    }, { status: 500 })
  }
}

export async function tryAcquireSyncLock({
  serviceName,
  subgraphName,
  staleMs = DEFAULT_SYNC_RUNNING_STALE_MS,
}: SyncStateKey & { staleMs?: number }): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - staleMs)
  const runningPayload = {
    service_name: serviceName,
    subgraph_name: subgraphName,
    status: 'running' as const,
    error_message: null,
  }

  try {
    const claimedRows = await db
      .update(subgraph_syncs)
      .set(runningPayload)
      .where(and(
        eq(subgraph_syncs.service_name, serviceName),
        eq(subgraph_syncs.subgraph_name, subgraphName),
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
        eq(subgraph_syncs.service_name, serviceName),
        eq(subgraph_syncs.subgraph_name, subgraphName),
      ))
      .limit(1)

    if (existingRows.length > 0) {
      return false
    }

    throw new Error(`Missing sync state row for ${serviceName}/${subgraphName}. Run the latest database migrations.`)
  }
  catch (error) {
    throw new Error(`Failed to claim sync lock: ${getErrorMessage(error)}`)
  }
}

export async function updateSyncStatus({
  serviceName,
  subgraphName,
  status,
  errorMessage,
  totalProcessed,
}: UpdateSyncStatusParams) {
  const updateData: typeof subgraph_syncs.$inferInsert = {
    service_name: serviceName,
    subgraph_name: subgraphName,
    status,
  }

  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage
  }

  if (totalProcessed !== undefined) {
    updateData.total_processed = totalProcessed
  }

  try {
    const updatedRows = await db
      .update(subgraph_syncs)
      .set(updateData)
      .where(and(
        eq(subgraph_syncs.service_name, serviceName),
        eq(subgraph_syncs.subgraph_name, subgraphName),
      ))
      .returning({ id: subgraph_syncs.id })

    if (updatedRows.length === 0) {
      throw new Error(`Missing sync state row for ${serviceName}/${subgraphName}. Run the latest database migrations.`)
    }
  }
  catch (error) {
    console.error(`Failed to update sync status to ${status}:`, error)
    throw error
  }
}

export function buildSyncAlreadyRunningResponse() {
  return NextResponse.json({
    success: false,
    message: 'Sync already running',
    skipped: true,
  }, { status: 409 })
}

export function buildCronErrorResponse(error: unknown, fallbackMessage?: string) {
  return NextResponse.json({
    success: false,
    error: error instanceof Error ? error.message : fallbackMessage ?? String(error),
  }, { status: 500 })
}

export function buildCronJsonResponse<TPayload>(payload: TPayload, status?: number) {
  return NextResponse.json(payload, status === undefined ? undefined : { status })
}
