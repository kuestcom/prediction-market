import { and, asc, eq, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon, polygonAmoy } from 'viem/chains'
import { isCronAuthorized } from '@/lib/auth-cron'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import { jobs } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { normalizeEventCreationAssetPayload } from '@/lib/event-creation'
import { loadEventCreationSignersFromEnv } from '@/lib/event-creation-signers'
import {
  assertSuccessfulTransactionReceipt,
  buildEventCreationJobDedupeKey,
  buildEventCreationPreparePayload,
  computeNextRecurringSchedule,
  truncateEventCreationError,
} from '@/lib/event-creation-worker'

export const maxDuration = 300

const JOB_TYPE = 'deploy_event_creation'
const JOB_BATCH_SIZE = 6
const PREPARE_POLL_DELAY_MS = 1500
const PREPARE_POLL_MAX_ATTEMPTS = 80
const FINALIZE_POLL_DELAY_MS = 1500
const FINALIZE_POLL_MAX_ATTEMPTS = 120

interface JobRow {
  id: string
  job_type: string
  dedupe_key: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  available_at: Date
}

interface MarketConfigResponse {
  defaultChainId?: number
}

interface PrepareAcceptedResponse {
  requestId: string
  chainId: number
  creator: string
  status: string
}

interface PendingRequestTx {
  id: string
  hash: string
}

interface PendingRequestPrepared {
  requestId: string
  chainId: number
  creator: string
  txPlan: Array<{
    id: string
    to: string
    value: string
    data: string
    description: string
    marketKey?: string
  }>
}

interface PendingRequestItem {
  requestId: string
  payloadHash: string
  status: string
  creator: string
  chainId: number
  expiresAt: number
  updatedAt: number
  errorMessage: string | null
  prepared: PendingRequestPrepared | null
  txs: PendingRequestTx[]
}

function isPrepareAcceptedResponse(value: unknown): value is PrepareAcceptedResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<PrepareAcceptedResponse>
  return typeof candidate.requestId === 'string'
    && typeof candidate.chainId === 'number'
    && typeof candidate.creator === 'string'
    && typeof candidate.status === 'string'
}

function isPendingRequestItem(value: unknown): value is PendingRequestItem {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<PendingRequestItem>
  return typeof candidate.requestId === 'string'
    && typeof candidate.payloadHash === 'string'
    && typeof candidate.status === 'string'
    && typeof candidate.creator === 'string'
    && typeof candidate.chainId === 'number'
    && Array.isArray(candidate.txs)
}

function isPendingResponse(value: unknown): value is { request: PendingRequestItem | null } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { request?: unknown }
  return candidate.request === null || isPendingRequestItem(candidate.request)
}

function readApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  if (typeof maybeError === 'string') {
    return maybeError
  }

  if (maybeError && typeof maybeError === 'object') {
    const maybeMessage = (maybeError as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      return maybeMessage
    }
  }

  return null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getChain(chainId: number) {
  if (chainId === polygon.id) {
    return polygon
  }

  if (chainId === polygonAmoy.id) {
    return polygonAmoy
  }

  throw new Error(`Unsupported chain id ${chainId}.`)
}

function normalizeConfirmedTxs(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PendingRequestTx[]
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const candidate = item as Partial<PendingRequestTx>
      if (typeof candidate.id !== 'string' || typeof candidate.hash !== 'string') {
        return null
      }
      return {
        id: candidate.id,
        hash: candidate.hash,
      } satisfies PendingRequestTx
    })
    .filter((item): item is PendingRequestTx => Boolean(item))
}

async function fetchMarketConfig() {
  const response = await fetch(`${process.env.CREATE_MARKET_URL}/market-config`, {
    method: 'GET',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null) as MarketConfigResponse | null
  if (!response.ok) {
    throw new Error(`Market config failed (${response.status})`)
  }

  return payload ?? {}
}

async function fetchPendingRequest(creator: string, chainId: number, requestId?: string) {
  const query = new URLSearchParams({
    creator,
    chainId: String(chainId),
  })
  if (requestId) {
    query.set('requestId', requestId)
  }

  const response = await fetch(`${process.env.CREATE_MARKET_URL}/pending?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null) as unknown
  const apiError = readApiError(payload)
  if (!response.ok || apiError || !isPendingResponse(payload)) {
    throw new Error(apiError || `Pending request lookup failed (${response.status})`)
  }

  return payload.request
}

async function pollPendingPreparation(creator: string, chainId: number, requestId: string, payloadHash: string) {
  for (let attempt = 1; attempt <= PREPARE_POLL_MAX_ATTEMPTS; attempt += 1) {
    const pending = await fetchPendingRequest(creator, chainId, requestId)
    if (!pending) {
      await sleep(PREPARE_POLL_DELAY_MS)
      continue
    }

    if (pending.payloadHash.toLowerCase() !== payloadHash.toLowerCase()) {
      throw new Error('Pending request payload hash mismatch.')
    }

    if (pending.prepared) {
      return pending
    }

    if (pending.errorMessage) {
      throw new Error(pending.errorMessage)
    }

    await sleep(PREPARE_POLL_DELAY_MS)
  }

  throw new Error('Timed out waiting for prepared event creation request.')
}

async function pollPendingFinalization(creator: string, chainId: number, requestId: string) {
  for (let attempt = 1; attempt <= FINALIZE_POLL_MAX_ATTEMPTS; attempt += 1) {
    const pending = await fetchPendingRequest(creator, chainId, requestId)
    if (!pending) {
      return
    }

    if (pending.status === 'finalized') {
      return
    }

    if (pending.errorMessage) {
      throw new Error(pending.errorMessage)
    }

    await sleep(FINALIZE_POLL_DELAY_MS)
  }

  throw new Error('Timed out waiting for event creation finalization.')
}

async function persistConfirmedTxs(requestId: string, creator: string, txs: PendingRequestTx[]) {
  const response = await fetch(`${process.env.CREATE_MARKET_URL}/tx-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestId,
      creator,
      txs,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(readApiError(payload) || `Tx confirm failed (${response.status})`)
  }
}

async function appendStoredAsset(formData: FormData, key: string, asset: ReturnType<typeof normalizeEventCreationAssetPayload>['eventImage'], required: boolean) {
  if (!asset?.publicUrl) {
    if (required) {
      throw new Error(`${key} is missing.`)
    }
    return
  }

  const response = await fetch(asset.publicUrl, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Could not download ${key} from storage.`)
  }

  const blob = await response.blob()
  formData.append(key, blob, asset.fileName || key)
}

async function prepareRequest(input: {
  creator: string
  chainId: number
  payloadJson: string
  payloadHash: string
  account: ReturnType<typeof privateKeyToAccount>
  assets: ReturnType<typeof normalizeEventCreationAssetPayload>
  recordId: string
}) {
  const authResponse = await fetch(`${process.env.CREATE_MARKET_URL}/prepare-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      creator: input.creator,
      chainId: input.chainId,
      payloadHash: input.payloadHash,
    }),
  })
  const authPayload = await authResponse.json().catch(() => null) as {
    requestId?: string
    nonce?: `0x${string}`
    expiresAt?: number
    payloadHash?: string
    creator?: string
    chainId?: number
    domain?: { name?: string, version?: string, verifyingContract?: string }
  } | null
  if (!authResponse.ok || !authPayload?.requestId || !authPayload.nonce || !authPayload.expiresAt || !authPayload.domain?.verifyingContract) {
    throw new Error(readApiError(authPayload) || `Auth challenge failed (${authResponse.status})`)
  }

  const signature = await input.account.signTypedData({
    domain: {
      name: authPayload.domain.name || 'Create Market',
      version: authPayload.domain.version || '1',
      chainId: input.chainId,
      verifyingContract: getAddress(authPayload.domain.verifyingContract),
    },
    types: {
      CreateMarketAuth: [
        { name: 'requestId', type: 'string' },
        { name: 'creator', type: 'address' },
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
      ],
    },
    primaryType: 'CreateMarketAuth',
    message: {
      requestId: authPayload.requestId,
      creator: getAddress(input.creator),
      payloadHash: input.payloadHash as `0x${string}`,
      nonce: authPayload.nonce,
      expiresAt: BigInt(authPayload.expiresAt),
      chainId: BigInt(input.chainId),
    },
  })

  const body = new FormData()
  body.append('payload', input.payloadJson)
  body.append('auth', JSON.stringify({
    requestId: authPayload.requestId,
    nonce: authPayload.nonce,
    expiresAt: authPayload.expiresAt,
    payloadHash: input.payloadHash,
    signature,
  }))

  await appendStoredAsset(body, 'eventImage', input.assets.eventImage, true)
  for (const [optionId, asset] of Object.entries(input.assets.optionImages)) {
    await appendStoredAsset(body, `optionImage:${optionId}`, asset, false)
  }
  for (const [teamKey, asset] of Object.entries(input.assets.teamLogos)) {
    await appendStoredAsset(body, `teamLogo:${teamKey}`, asset, false)
  }

  const response = await fetch(`${process.env.CREATE_MARKET_URL}/prepare`, {
    method: 'POST',
    body,
  })
  const payload = await response.json().catch(() => null) as unknown
  const apiError = readApiError(payload)
  if (!response.ok || apiError || !isPrepareAcceptedResponse(payload)) {
    throw new Error(apiError || `Prepare failed (${response.status})`)
  }

  return payload
}

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
    enqueued += 1
  }

  return enqueued
}

async function loadPendingJobs(now: Date) {
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
    })
    .from(jobs)
    .where(and(
      eq(jobs.job_type, JOB_TYPE),
      eq(jobs.status, 'pending'),
      lte(jobs.available_at, now),
    ))
    .orderBy(asc(jobs.available_at), asc(jobs.updated_at))
    .limit(JOB_BATCH_SIZE)

  return rows as JobRow[]
}

async function claimJob(job: JobRow, now: Date) {
  const claimed = await db
    .update(jobs)
    .set({
      status: 'processing',
      reserved_at: now,
      last_error: null,
    })
    .where(and(
      eq(jobs.id, job.id),
      eq(jobs.status, 'pending'),
      lte(jobs.available_at, now),
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
    })

  return (claimed[0] as JobRow | undefined) ?? null
}

async function completeJob(job: JobRow) {
  await db
    .update(jobs)
    .set({
      status: 'completed',
      attempts: (job.attempts ?? 0) + 1,
      reserved_at: null,
      last_error: null,
      available_at: new Date(),
    })
    .where(eq(jobs.id, job.id))
}

function buildRetryAt(attempts: number) {
  const backoffMinutes = Math.min(60, 5 * attempts)
  return new Date(Date.now() + (backoffMinutes * 60_000))
}

async function scheduleRetry(job: JobRow, error: unknown) {
  const attempts = (job.attempts ?? 0) + 1
  const exhausted = attempts >= (job.max_attempts ?? 6)

  await db
    .update(jobs)
    .set({
      status: exhausted ? 'failed' : 'pending',
      attempts,
      available_at: exhausted ? new Date() : buildRetryAt(attempts),
      reserved_at: null,
      last_error: truncateEventCreationError(error),
    })
    .where(eq(jobs.id, job.id))

  return { exhausted }
}

async function processClaimedJob(job: JobRow, defaultChainId: number) {
  const draftId = typeof job.payload?.draftId === 'string' ? job.payload.draftId : ''
  if (!draftId) {
    throw new Error('Job payload is missing draftId.')
  }

  const draftResult = await EventCreationRepository.getDraftById({ draftId })
  if (draftResult.error || !draftResult.data) {
    throw new Error(draftResult.error ?? 'Draft not found.')
  }

  const draft = draftResult.data
  const configuredSigners = loadEventCreationSignersFromEnv()
  const selectedSigner = configuredSigners.find(item => item.address.toLowerCase() === (draft.walletAddress ?? '').toLowerCase())
  if (!selectedSigner) {
    throw new Error('Selected server wallet is not configured in EVENT_CREATION_SIGNER_PRIVATE_KEYS.')
  }

  const account = privateKeyToAccount(selectedSigner.privateKey)
  const chain = getChain(defaultChainId)
  const creator = getAddress(account.address)
  const preparedInput = buildEventCreationPreparePayload({
    record: draft,
    creator,
    chainId: chain.id,
  })
  const payloadJson = JSON.stringify(preparedInput.payload)
  const payloadHash = keccak256(stringToHex(payloadJson))
  const assets = normalizeEventCreationAssetPayload(draft.assetPayload)

  await EventCreationRepository.setExecutionState({
    draftId: draft.id,
    status: 'running',
    lastError: null,
    lastRunAt: new Date(),
  })

  let pending = draft.pendingRequestId
    && draft.pendingPayloadHash?.toLowerCase() === payloadHash.toLowerCase()
    && draft.pendingChainId === chain.id
    ? await fetchPendingRequest(creator, chain.id, draft.pendingRequestId)
    : null

  if (pending && pending.payloadHash.toLowerCase() !== payloadHash.toLowerCase()) {
    pending = null
  }

  if (!pending?.prepared) {
    const prepared = await prepareRequest({
      creator,
      chainId: chain.id,
      payloadJson,
      payloadHash,
      account,
      assets,
      recordId: draft.id,
    })

    pending = await pollPendingPreparation(creator, chain.id, prepared.requestId, payloadHash)
  }

  if (!pending?.prepared) {
    throw new Error('Prepared event creation request is missing tx plan.')
  }

  let confirmedTxs = normalizeConfirmedTxs(draft.pendingConfirmedTxs)
  if (pending.txs.length > confirmedTxs.length) {
    confirmedTxs = pending.txs
  }

  await EventCreationRepository.setExecutionState({
    draftId: draft.id,
    status: 'running',
    pendingRequestId: pending.requestId,
    pendingPayloadHash: payloadHash,
    pendingChainId: chain.id,
    pendingConfirmedTxs: confirmedTxs as unknown as Array<Record<string, unknown>>,
  })

  const publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })
  const confirmedMap = new Map(confirmedTxs.map(item => [item.id, item.hash] as const))

  for (const tx of pending.prepared.txPlan) {
    let hash = confirmedMap.get(tx.id) as `0x${string}` | undefined

    if (!hash) {
      hash = await walletClient.sendTransaction({
        account,
        chain,
        to: getAddress(tx.to),
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value),
      }) as `0x${string}`

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      })
      assertSuccessfulTransactionReceipt(receipt, hash)

      confirmedTxs = [...confirmedTxs.filter(item => item.id !== tx.id), {
        id: tx.id,
        hash,
      }]
      confirmedMap.set(tx.id, hash)
      await persistConfirmedTxs(pending.requestId, creator, confirmedTxs)

      await EventCreationRepository.setExecutionState({
        draftId: draft.id,
        status: 'running',
        pendingRequestId: pending.requestId,
        pendingPayloadHash: payloadHash,
        pendingChainId: chain.id,
        pendingConfirmedTxs: confirmedTxs as unknown as Array<Record<string, unknown>>,
      })
      continue
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
    })
    assertSuccessfulTransactionReceipt(receipt, hash as `0x${string}`)
  }

  const finalizeResponse = await fetch(`${process.env.CREATE_MARKET_URL}/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestId: pending.requestId,
      creator,
      txs: confirmedTxs,
    }),
  })
  const finalizePayload = await finalizeResponse.json().catch(() => null) as {
    requestId?: string
    status?: string
  } | null
  if (!finalizeResponse.ok) {
    throw new Error(readApiError(finalizePayload) || `Finalize failed (${finalizeResponse.status})`)
  }

  if (finalizePayload?.status === 'finalize_in_progress') {
    await pollPendingFinalization(creator, chain.id, pending.requestId)
  }
  else if (finalizePayload?.status !== 'finalized') {
    throw new Error(`Unexpected finalize status: ${finalizePayload?.status ?? 'unknown'}`)
  }

  const nextRecurringSchedule = computeNextRecurringSchedule(draft)
  await EventCreationRepository.setExecutionState({
    draftId: draft.id,
    status: nextRecurringSchedule ? 'scheduled' : 'deployed',
    lastError: null,
    lastRunAt: new Date(),
    nextStartAt: nextRecurringSchedule?.nextStartAt ?? undefined,
    nextDeployAt: nextRecurringSchedule?.nextDeployAt ?? undefined,
    pendingRequestId: null,
    pendingPayloadHash: null,
    pendingChainId: null,
    pendingConfirmedTxs: [],
  })

  await completeJob(job)
}

async function runSync() {
  const now = new Date()
  const marketConfig = await fetchMarketConfig()
  const defaultChainId = typeof marketConfig.defaultChainId === 'number' ? marketConfig.defaultChainId : polygonAmoy.id
  const enqueued = await enqueueDueJobs(now)
  const pendingJobs = await loadPendingJobs(now)

  let processed = 0
  let failed = 0
  const errors: Array<{ jobId: string, message: string }> = []

  for (const job of pendingJobs) {
    const claimed = await claimJob(job, now)
    if (!claimed) {
      continue
    }

    try {
      await processClaimedJob(claimed, defaultChainId)
      processed += 1
    }
    catch (error) {
      failed += 1
      errors.push({
        jobId: claimed.id,
        message: truncateEventCreationError(error),
      })

      const retry = await scheduleRetry(claimed, error)
      const draftId = typeof claimed.payload?.draftId === 'string' ? claimed.payload.draftId : null
      if (draftId) {
        await EventCreationRepository.setExecutionState({
          draftId,
          status: retry.exhausted ? 'failed' : 'scheduled',
          lastError: truncateEventCreationError(error),
        })
      }
    }
  }

  return {
    success: true,
    enqueued,
    processed,
    failed,
    errors,
  }
}

async function handleRequest(request: Request) {
  const auth = request.headers.get('authorization')
  if (!isCronAuthorized(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  try {
    const result = await runSync()
    return NextResponse.json(result)
  }
  catch (error) {
    console.error('event-creation-sync failed', error)
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
