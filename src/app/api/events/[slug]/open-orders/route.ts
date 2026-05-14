import type { OpenOrderOutcomeMeta } from '@/lib/clob-open-orders'
import type { ClobOrderType, UserOpenOrder } from '@/types'
import { NextResponse } from 'next/server'
import {
  mapClobOpenOrder,
  normalizeClobId,
  normalizeClobOpenOrdersResponse,

} from '@/lib/clob-open-orders'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
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
    const user = await UserRepository.getCurrentUser({ minimal: true })
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
      return NextResponse.json({ error: TRADING_AUTH_REQUIRED_ERROR }, { status: 401 })
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
      ? marketMetadata.filter(market => normalizeClobId(market.condition_id) === normalizeClobId(conditionId))
      : marketMetadata

    if (!targetMarkets.length) {
      return NextResponse.json({ data: [], next_cursor: 'LTE=' })
    }

    const { marketMap, outcomeMap } = buildMarketLookups(targetMarkets)

    const { data: clobOrders, next_cursor } = await fetchClobOpenOrders({
      market: conditionId,
      makerAddress: user.deposit_wallet_address ?? undefined,
      userAddress: user.address,
      auth: tradingAuth.clob,
      nextCursor,
    })

    const normalizedOrders = clobOrders
      .map(order => mapClobOpenOrder(order, marketMap, outcomeMap))
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
  const outcomeMap = new Map<string, OpenOrderOutcomeMeta>()

  markets.forEach((market) => {
    const normalizedConditionId = normalizeClobId(market.condition_id)
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
      const tokenKey = normalizeClobId(outcome.token_id)
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
  makerAddress,
  auth,
  userAddress,
  nextCursor,
}: {
  market?: string
  makerAddress?: string
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
  if (makerAddress) {
    searchParams.set('maker_address', makerAddress)
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
