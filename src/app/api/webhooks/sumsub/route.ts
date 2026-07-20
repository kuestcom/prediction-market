import type { SumsubStatus } from '@/lib/sumsub/types'
import { Buffer } from 'node:buffer'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { SumsubRepository } from '@/lib/db/queries/sumsub'
import { getSumsubSettings } from '@/lib/sumsub/settings'

const MAX_BODY_SIZE = 64 * 1024
const ALGORITHMS = {
  HMAC_SHA256_HEX: 'sha256',
  HMAC_SHA512_HEX: 'sha512',
} as const
const EVENT_TYPES = new Set([
  'applicantCreated',
  'applicantPending',
  'applicantAwaitingUser',
  'applicantOnHold',
  'applicantReset',
  'applicantReviewed',
])

function safeEqualHex(expected: string, received: string) {
  if (!/^[a-f\d]+$/i.test(received) || expected.length !== received.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
}

function normalizeStatus(payload: Record<string, any>): SumsubStatus {
  const answer = payload.reviewResult?.reviewAnswer
  const eventType = payload.type
  if (eventType === 'applicantReviewed') {
    return answer === 'GREEN' ? 'approved' : 'rejected'
  }
  if (eventType === 'applicantOnHold') {
    return 'on_hold'
  }
  if (eventType === 'applicantReset') {
    return 'not_started'
  }
  if (eventType === 'applicantPending' || eventType === 'applicantAwaitingUser' || eventType === 'applicantCreated') {
    return 'pending'
  }
  return 'pending'
}

function parseEventDate(createdAtMs: unknown, createdAt: unknown) {
  if (typeof createdAtMs === 'number' || (typeof createdAtMs === 'string' && /^\d+$/.test(createdAtMs))) {
    return new Date(Number(createdAtMs))
  }
  if (typeof createdAtMs === 'string') {
    const utcDate = createdAtMs.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3})$/)
    if (utcDate) {
      return new Date(`${utcDate[1]}T${utcDate[2]}Z`)
    }
  }
  return new Date(typeof createdAt === 'string' ? createdAt : '')
}

export async function POST(request: Request) {
  let raw: Uint8Array
  try {
    const declaredLength = Number(request.headers.get('content-length') || '0')
    if (declaredLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
    raw = new Uint8Array(await request.arrayBuffer())
    if (raw.byteLength === 0 || raw.byteLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }
  }
  catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  let settings
  try {
    settings = await getSumsubSettings()
  }
  catch {
    return NextResponse.json({ error: 'Webhook unavailable.' }, { status: 503 })
  }
  if (!settings.webhookSecret) {
    return NextResponse.json({ error: 'Webhook unavailable.' }, { status: 503 })
  }

  const algorithmHeader = request.headers.get('x-payload-digest-alg') as keyof typeof ALGORITHMS | null
  const digest = request.headers.get('x-payload-digest') ?? ''
  const algorithm = algorithmHeader ? ALGORITHMS[algorithmHeader] : undefined
  if (!algorithm) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }
  const expected = createHmac(algorithm, settings.webhookSecret).update(raw).digest('hex')
  if (!safeEqualHex(expected, digest)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let payload: Record<string, any>
  try {
    payload = JSON.parse(Buffer.from(raw).toString('utf8'))
  }
  catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const applicantId = typeof payload.applicantId === 'string' ? payload.applicantId : ''
  const externalUserId = typeof payload.externalUserId === 'string' ? payload.externalUserId : ''
  const levelName = typeof payload.levelName === 'string' ? payload.levelName : ''
  const eventType = typeof payload.type === 'string' ? payload.type : ''
  const createdAt = parseEventDate(payload.createdAtMs, payload.createdAt)
  if (!applicantId || !externalUserId || !levelName || !EVENT_TYPES.has(eventType) || Number.isNaN(createdAt.getTime())) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const fingerprint = createHash('sha256').update(raw).digest('hex')
  try {
    await SumsubRepository.processWebhook(fingerprint, {
      applicantId,
      externalUserId,
      levelName,
      status: normalizeStatus(payload),
      reviewStatus: typeof payload.reviewStatus === 'string' ? payload.reviewStatus : null,
      reviewAnswer: typeof payload.reviewResult?.reviewAnswer === 'string' ? payload.reviewResult.reviewAnswer : null,
      eventCreatedAt: createdAt,
    }, eventType)
    return NextResponse.json({ ok: true })
  }
  catch {
    return NextResponse.json({ error: 'Webhook could not be processed.' }, { status: 409 })
  }
}
