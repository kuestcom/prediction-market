import type { MarketContextResponse } from '@/lib/market-context-service'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { UserRepository } from '@/lib/db/queries/user'
import { MarketContextRequestSchema, resolveMarketContextRequest } from '@/lib/market-context-service'

const MARKET_CONTEXT_GENERATION_LIMIT = 5
const MARKET_CONTEXT_GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000
const MARKET_CONTEXT_GENERATION_COOKIE_NAME = 'market_context_generation_quota'

interface MarketContextGenerationQuota {
  subject: string
  count: number
  windowStart: number
}

function resolveQuotaSecret() {
  return process.env.BETTER_AUTH_SECRET
    || process.env.CRON_SECRET
    || 'market-context-generation-local-secret'
}

function signQuotaValue(encodedPayload: string) {
  return crypto
    .createHmac('sha256', resolveQuotaSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function encodeQuotaCookie(payload: MarketContextGenerationQuota) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encodedPayload}.${signQuotaValue(encodedPayload)}`
}

function parseQuotaCookie(rawValue: string | undefined, subject: string, nowMs: number) {
  if (!rawValue) {
    return null
  }

  const [encodedPayload, signature] = rawValue.split('.')
  if (!encodedPayload || !signature || signQuotaValue(encodedPayload) !== signature) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as MarketContextGenerationQuota
    if (
      payload.subject !== subject
      || !Number.isInteger(payload.count)
      || !Number.isInteger(payload.windowStart)
      || payload.windowStart + MARKET_CONTEXT_GENERATION_WINDOW_MS <= nowMs
    ) {
      return null
    }

    return payload
  }
  catch {
    return null
  }
}

async function consumeMarketContextGenerationQuota(userId: string | undefined): Promise<MarketContextResponse | null> {
  const subject = userId ? `user:${userId}` : 'anonymous'
  const nowMs = Date.now()
  const cookieStore = await cookies()
  const existingQuota = parseQuotaCookie(
    cookieStore.get(MARKET_CONTEXT_GENERATION_COOKIE_NAME)?.value,
    subject,
    nowMs,
  ) ?? {
    subject,
    count: 0,
    windowStart: nowMs,
  }

  if (existingQuota.count >= MARKET_CONTEXT_GENERATION_LIMIT) {
    return {
      error: 'Market context generation limit reached. Try again later.',
      status: 429,
    }
  }

  cookieStore.set(MARKET_CONTEXT_GENERATION_COOKIE_NAME, encodeQuotaCookie({
    ...existingQuota,
    count: existingQuota.count + 1,
  }), {
    httpOnly: true,
    maxAge: Math.ceil(MARKET_CONTEXT_GENERATION_WINDOW_MS / 1000),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return null
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const parsedPayload = MarketContextRequestSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return Response.json(
      { error: parsedPayload.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    )
  }

  const currentUser = parsedPayload.data.readOnly
    ? null
    : await UserRepository.getCurrentUser({ minimal: true })
  const result = await resolveMarketContextRequest(parsedPayload.data, {
    beforeGenerate: () => consumeMarketContextGenerationQuota(currentUser?.id),
  })
  const { status = 200, ...responseBody } = result

  return Response.json(responseBody, { status })
}
