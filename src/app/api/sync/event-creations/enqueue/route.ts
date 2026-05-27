import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import {
  buildEventCreationJobDedupeKey,
  truncateEventCreationError,
} from '@/lib/event-creation-worker'

export const maxDuration = 60

async function enqueueDueJobs(now: Date) {
  const dueResult = await EventCreationRepository.listDueScheduledDrafts(now)
  if (dueResult.error || !dueResult.data) {
    throw new Error(dueResult.error ?? 'Could not load due scheduled event creations.')
  }

  let enqueued = 0
  for (const draft of dueResult.data) {
    const enqueueResult = await EventCreationRepository.enqueueDeployJob({
      draftId: draft.id,
      dedupeKey: buildEventCreationJobDedupeKey(draft),
      availableAt: now,
    })
    if (enqueueResult.error) {
      throw new Error(enqueueResult.error)
    }
    if (enqueueResult.data) {
      enqueued += 1
    }
  }

  return {
    scanned: dueResult.data.length,
    enqueued,
  }
}

async function runEnqueue() {
  const result = await enqueueDueJobs(new Date())

  return {
    success: true,
    ...result,
  }
}

async function handleRequest(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const result = await runEnqueue()
    return NextResponse.json(result)
  }
  catch (error) {
    console.error('event-creation-enqueue failed', error)
    return NextResponse.json({
      success: false,
      error: truncateEventCreationError(error),
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
