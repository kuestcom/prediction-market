import { NextResponse } from 'next/server'
import {
  consumeArbitrageOrderQuota,
  getArbitrageOrderQuotaStatus,
  isActivePolymarketMirrorToken,
  isArbitrageOrderSubmissionEnabled,
} from '@/lib/arbitrage-order-security'
import { UserRepository } from '@/lib/db/queries/user'

const POLYMARKET_ORDER_URL = 'https://clob.polymarket.com/order'
const MAX_REQUEST_SIZE = 32_000
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const INTEGER_PATTERN = /^\d{1,78}$/
const BYTES_32_PATTERN = /^0x[a-fA-F0-9]{64}$/
const SIGNATURE_PATTERN = /^0x(?:[a-fA-F0-9]{2}){65,4095}$/
const MAX_UINT_256 = 2n ** 256n - 1n
const REQUIRED_HEADERS = [
  'POLY_ADDRESS',
  'POLY_SIGNATURE',
  'POLY_TIMESTAMP',
  'POLY_API_KEY',
  'POLY_PASSPHRASE',
] as const

function readPolymarketHeaders(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const headers: Record<string, string> = {}
  for (const name of REQUIRED_HEADERS) {
    const headerValue = record[name]
    if (typeof headerValue !== 'string' || !headerValue || headerValue.length > 1_024) {
      return null
    }
    headers[name] = headerValue
  }
  if (
    !ADDRESS_PATTERN.test(headers.POLY_ADDRESS)
    || !/^\d{1,16}$/.test(headers.POLY_TIMESTAMP)
  ) {
    return null
  }
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isUint256String(
  value: unknown,
  { positive = false }: { positive?: boolean } = {},
): value is string {
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) {
    return false
  }
  const parsed = BigInt(value)
  return parsed <= MAX_UINT_256 && (!positive || parsed > 0n)
}

function isValidVersionedOrder(order: Record<string, unknown>, signatureType: number) {
  const isV1Order = (
    signatureType <= 2
    && typeof order.taker === 'string'
    && ADDRESS_PATTERN.test(order.taker)
    && isUint256String(order.expiration)
    && isUint256String(order.nonce)
    && isUint256String(order.feeRateBps)
  )
  const isV2Order = (
    (order.taker === undefined || order.taker === null)
    && isUint256String(order.timestamp, { positive: true })
    && isUint256String(order.expiration)
    && typeof order.metadata === 'string'
    && BYTES_32_PATTERN.test(order.metadata)
    && typeof order.builder === 'string'
    && BYTES_32_PATTERN.test(order.builder)
  )

  return isV1Order || isV2Order
}

function parsePolymarketOrderBody(value: string) {
  if (!value || value.length > MAX_REQUEST_SIZE) {
    return null
  }

  try {
    const payload = JSON.parse(value) as Record<string, unknown>
    const order = payload.order
    if (
      payload.orderType !== 'FOK'
      || payload.postOnly !== false
      || payload.deferExec !== false
      || typeof payload.owner !== 'string'
      || !payload.owner
      || payload.owner.length > 256
      || !isRecord(order)
      || order.side !== 'BUY'
      || !isUint256String(order.tokenId, { positive: true })
      || typeof order.maker !== 'string'
      || !ADDRESS_PATTERN.test(order.maker)
      || typeof order.signer !== 'string'
      || !ADDRESS_PATTERN.test(order.signer)
      || !isUint256String(order.makerAmount, { positive: true })
      || !isUint256String(order.takerAmount, { positive: true })
      || BigInt(order.makerAmount as string) >= BigInt(order.takerAmount as string)
      || !Number.isSafeInteger(order.salt)
      || Number(order.salt) < 0
      || typeof order.signature !== 'string'
      || !SIGNATURE_PATTERN.test(order.signature)
      || !Number.isInteger(order.signatureType)
      || Number(order.signatureType) < 0
      || Number(order.signatureType) > 3
      || !isValidVersionedOrder(order, Number(order.signatureType))
    ) {
      return null
    }

    return {
      owner: payload.owner,
      signer: order.signer,
      signatureType: Number(order.signatureType),
      tokenId: order.tokenId,
    }
  }
  catch {
    return null
  }
}

async function handlePost(request: Request) {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  let arbitrageEnabled: boolean
  try {
    arbitrageEnabled = await isArbitrageOrderSubmissionEnabled()
  }
  catch (error) {
    console.error('Failed to validate the arbitrage feature toggle.', error)
    return NextResponse.json({ error: 'Polymarket order service is temporarily unavailable.' }, { status: 503 })
  }
  if (!arbitrageEnabled) {
    return NextResponse.json({ error: 'Arbitrage trading is disabled.' }, { status: 403 })
  }

  const requestBody = await request.text()
  if (!requestBody || requestBody.length > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: 'Invalid Polymarket order request.' }, { status: 400 })
  }

  let input: { headers?: unknown, body?: unknown }
  try {
    input = JSON.parse(requestBody) as { headers?: unknown, body?: unknown }
  }
  catch {
    return NextResponse.json({ error: 'Invalid Polymarket order request.' }, { status: 400 })
  }

  const polymarketHeaders = readPolymarketHeaders(input.headers)
  const orderBody = typeof input.body === 'string' ? input.body : ''
  const parsedOrder = parsePolymarketOrderBody(orderBody)
  if (
    !polymarketHeaders
    || !parsedOrder
    || (
      parsedOrder.signatureType !== 3
      && polymarketHeaders.POLY_ADDRESS.toLowerCase() !== parsedOrder.signer.toLowerCase()
    )
    || polymarketHeaders.POLY_API_KEY !== parsedOrder.owner
  ) {
    return NextResponse.json({ error: 'Invalid Polymarket order request.' }, { status: 400 })
  }

  let quota: Awaited<ReturnType<typeof consumeArbitrageOrderQuota>>
  try {
    quota = await consumeArbitrageOrderQuota(user.id)
  }
  catch (error) {
    console.error('Failed to apply the Polymarket order rate limit. Run the latest database migrations.', error)
    return NextResponse.json({ error: 'Polymarket order service is temporarily unavailable.' }, { status: 503 })
  }
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Too many Polymarket order requests.' },
      {
        status: 429,
        headers: { 'Retry-After': String(quota.retryAfterSeconds) },
      },
    )
  }

  let isAllowedToken: boolean
  try {
    isAllowedToken = await isActivePolymarketMirrorToken(parsedOrder.tokenId)
  }
  catch (error) {
    console.error('Failed to validate the mirrored Polymarket token.', error)
    return NextResponse.json({ error: 'Polymarket order service is temporarily unavailable.' }, { status: 503 })
  }
  if (!isAllowedToken) {
    return NextResponse.json({ error: 'Polymarket token is not enabled for arbitrage.' }, { status: 403 })
  }

  let response: Response
  try {
    response = await fetch(POLYMARKET_ORDER_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...polymarketHeaders,
      },
      body: orderBody,
      cache: 'no-store',
    })
  }
  catch (error) {
    console.error('Failed to submit the Polymarket order.', error)
    return NextResponse.json({ error: 'Polymarket order submission unavailable.' }, { status: 502 })
  }

  const responseBody = await response.text()

  return new Response(responseBody || JSON.stringify({ error: 'Empty Polymarket response.' }), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
  })
}

async function handleGet(request: Request) {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  if (!await isArbitrageOrderSubmissionEnabled()) {
    return NextResponse.json({ error: 'Arbitrage trading is disabled.' }, { status: 403 })
  }

  const tokenId = new URL(request.url).searchParams.get('tokenId')?.trim()
  if (!isUint256String(tokenId, { positive: true })) {
    return NextResponse.json({ error: 'Invalid Polymarket token.' }, { status: 400 })
  }

  const quota = await getArbitrageOrderQuotaStatus(user.id)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Too many Polymarket order requests.' },
      {
        status: 429,
        headers: { 'Retry-After': String(quota.retryAfterSeconds) },
      },
    )
  }

  if (!await isActivePolymarketMirrorToken(tokenId)) {
    return NextResponse.json({ error: 'Polymarket token is not enabled for arbitrage.' }, { status: 403 })
  }

  return NextResponse.json({ ready: true })
}

export async function GET(request: Request) {
  try {
    return await handleGet(request)
  }
  catch (error) {
    console.error('Polymarket order preflight failed.', error)
    return NextResponse.json({ error: 'Polymarket order service is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    return await handlePost(request)
  }
  catch (error) {
    console.error('Unexpected Polymarket order proxy failure.', error)
    return NextResponse.json({ error: 'Polymarket order service is temporarily unavailable.' }, { status: 500 })
  }
}
