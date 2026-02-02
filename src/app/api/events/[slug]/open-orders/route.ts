import type { ClobOrderType, UserOpenOrder } from '@/types'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE, MICRO_UNIT } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

const CLOB_URL = process.env.CLOB_URL

interface ClobOpenOrder {
  id: string
  status: string
  market: string
  original_size: string
  outcome?: string
  maker_address: string
  owner?: string
  price?: string
  side: 'BUY' | 'SELL'
  size_matched: string
  asset_id: string
  expiration?: string
  type?: ClobOrderType
  created_at: string
  updated_at: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await UserRepository.getCurrentUser()
    const { slug } = await params

    if (!slug) {
      return NextResponse.json(
        { error: 'Event slug is required.' },
        { status: 422 },
      )
    }

    if (!user) {
      return NextResponse.json({ data: [], next_cursor: 'LTE=' })
    }

    if (!CLOB_URL) {
      console.error('Missing CLOB_URL environment variable.')
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    const tradingAuth = await getUserTradingAuthSecrets(user.id)
    if (!tradingAuth?.clob) {
      return NextResponse.json({ data: [], next_cursor: 'LTE=' })
    }

    const { searchParams } = new URL(request.url)
    const conditionIdParam = searchParams.get('conditionId')
    const nextCursor = searchParams.get('next_cursor')?.trim() || undefined
    const conditionId = conditionIdParam && conditionIdParam.trim().length > 0
      ? conditionIdParam.trim()
      : undefined

    const { data: marketMetadata, error: marketError } = await EventRepository.getEventMarketMetadata(slug)
    if (marketError || !marketMetadata || marketMetadata.length === 0) {
      return NextResponse.json({ data: [], next_cursor: 'LTE=' })
    }

    const targetMarkets = conditionId
      ? marketMetadata.filter(market => normalizeId(market.condition_id) === normalizeId(conditionId))
      : marketMetadata

    if (!targetMarkets.length) {
      return NextResponse.json({ data: [], next_cursor: 'LTE=' })
    }

    const { marketMap, outcomeMap } = buildMarketLookups(targetMarkets)

    const { data: clobOrders, next_cursor } = await fetchClobOpenOrders({
      market: conditionId,
      userAddress: user.address,
      auth: tradingAuth.clob,
      nextCursor,
    })

    const normalizedOrders = clobOrders
      .map(order => mapClobOrder(order, marketMap, outcomeMap))
      .filter((order): order is UserOpenOrder => Boolean(order))
    return NextResponse.json({ data: normalizedOrders, next_cursor })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}

function buildMarketLookups(markets: Array<{
  condition_id: string
  title: string
  slug: string
  is_active: boolean
  is_resolved: boolean
  outcomes: Array<{
    token_id: string
    outcome_text: string
    outcome_index: number
  }>
}>) {
  const marketMap = new Map<string, UserOpenOrder['market']>()
  const outcomeMap = new Map<string, { index: number, text: string }>()

  markets.forEach((market) => {
    const normalizedConditionId = normalizeId(market.condition_id)
    if (normalizedConditionId) {
      marketMap.set(normalizedConditionId, {
        condition_id: market.condition_id,
        title: market.title,
        slug: market.slug,
        is_active: market.is_active,
        is_resolved: market.is_resolved,
      })
    }

    market.outcomes.forEach((outcome) => {
      const tokenKey = normalizeId(outcome.token_id)
      if (!tokenKey) {
        return
      }
      outcomeMap.set(tokenKey, {
        index: outcome.outcome_index,
        text: outcome.outcome_text || '',
      })
    })
  })

  return { marketMap, outcomeMap }
}

async function fetchClobOpenOrders({
  market,
  auth,
  userAddress,
  nextCursor,
}: {
  market?: string
  auth: { key: string, secret: string, passphrase: string }
  userAddress: string
  nextCursor?: string
}): Promise<{ data: ClobOpenOrder[], next_cursor: string }> {
  if (!CLOB_URL) {
    throw new Error('CLOB_URL is not configured.')
  }

  const searchParams = new URLSearchParams()
  if (market) {
    searchParams.set('market', market)
  }
  if (nextCursor) {
    searchParams.set('next_cursor', nextCursor)
  }

  const path = '/data/orders'
  const query = searchParams.toString()
  const pathWithQuery = query ? `${path}?${query}` : path
  const url = `${CLOB_URL}${pathWithQuery}`
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.secret, timestamp, 'GET', pathWithQuery)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      KUEST_ADDRESS: userAddress,
      KUEST_API_KEY: auth.key,
      KUEST_PASSPHRASE: auth.passphrase,
      KUEST_TIMESTAMP: timestamp.toString(),
      KUEST_SIGNATURE: signature,
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = typeof payload?.error === 'string' ? payload.error : undefined
    throw new Error(message || `Failed to fetch open orders (status ${response.status})`)
  }

  const result = await response.json().catch(() => null)
  return normalizeClobOpenOrdersResponse(result)
}

function mapClobOrder(
  order: ClobOpenOrder,
  marketMap: Map<string, UserOpenOrder['market']>,
  outcomeMap: Map<string, { index: number, text: string }>,
): UserOpenOrder | null {
  const marketMeta = marketMap.get(normalizeId(order.market))
  if (!marketMeta) {
    return null
  }

  const outcomeMeta = resolveOutcome(order, outcomeMap)
  const side = order.side === 'SELL' ? 'sell' : 'buy'
  const priceValue = clampNumber(parseNumber(order.price), 0, 1)
  const totalShares = Math.max(parseNumber(order.original_size), 0)
  const filledShares = Math.max(parseNumber(order.size_matched), 0)
  const { makerAmount, takerAmount } = calculateAmounts(totalShares, priceValue, side)
  const expiry = parseNumber(order.expiration)
  const createdAt = order.created_at

  return {
    id: order.id,
    side,
    type: order.type ?? 'GTC',
    status: order.status || 'live',
    price: priceValue,
    maker_amount: makerAmount,
    taker_amount: takerAmount,
    size_matched: Math.round(filledShares * MICRO_UNIT),
    created_at: createdAt,
    expiration: Number.isFinite(expiry) ? expiry : null,
    outcome: {
      index: outcomeMeta?.index ?? 0,
      text: outcomeMeta?.text || '',
    },
    market: marketMeta,
  }
}

function resolveOutcome(order: ClobOpenOrder, outcomeMap: Map<string, { index: number, text: string }>) {
  const candidates = [order.asset_id, order.outcome]
  for (const candidate of candidates) {
    const normalized = normalizeId(candidate)
    if (!normalized) {
      continue
    }

    if (outcomeMap.has(normalized)) {
      return outcomeMap.get(normalized)
    }

    if (normalized.includes(':')) {
      const [base] = normalized.split(':')
      if (base && outcomeMap.has(base)) {
        return outcomeMap.get(base)
      }
    }
  }
  return undefined
}

function calculateAmounts(totalShares: number, price: number, side: 'buy' | 'sell') {
  const sharesMicro = Math.round(totalShares * MICRO_UNIT)
  const valueMicro = Math.round(totalShares * price * MICRO_UNIT)

  if (side === 'buy') {
    return {
      makerAmount: valueMicro,
      takerAmount: sharesMicro,
    }
  }

  return {
    makerAmount: sharesMicro,
    takerAmount: valueMicro,
  }
}

function normalizeId(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function parseNumber(value?: string | number | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

function normalizeClobOpenOrdersResponse(result: unknown) {
  if (Array.isArray(result)) {
    return { data: result as ClobOpenOrder[], next_cursor: 'LTE=' }
  }

  if (result && typeof result === 'object') {
    const data = Array.isArray((result as { data?: unknown }).data)
      ? (result as { data: ClobOpenOrder[] }).data
      : []
    const next_cursor = typeof (result as { next_cursor?: unknown }).next_cursor === 'string'
      ? (result as { next_cursor: string }).next_cursor
      : 'LTE='
    return { data, next_cursor }
  }

  return { data: [], next_cursor: 'LTE=' }
}
