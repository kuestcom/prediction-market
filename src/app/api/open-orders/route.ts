import type { ClobOrderType, UserOpenOrder } from '@/types'
import { inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE, MICRO_UNIT } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { markets } from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { buildClobHmacSignature } from '@/lib/hmac'
import { getSupabaseImageUrl } from '@/lib/supabase'
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

export async function GET(request: Request) {
  try {
    const user = await UserRepository.getCurrentUser()
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
    const idFilter = searchParams.get('id')?.trim() || undefined
    const marketFilter = searchParams.get('market')?.trim() || undefined
    const assetIdFilter = searchParams.get('asset_id')?.trim() || undefined
    const nextCursor = searchParams.get('next_cursor')?.trim() || undefined

    const { data: clobOrders, next_cursor } = await fetchClobOpenOrders({
      auth: tradingAuth.clob,
      userAddress: user.address,
      makerAddress: user.proxy_wallet_address as string,
      id: idFilter,
      market: marketFilter,
      assetId: assetIdFilter,
      nextCursor,
    })

    const conditionIds = Array.from(
      new Set(
        clobOrders
          .map(order => normalizeId(order.market))
          .filter(Boolean),
      ),
    )

    const { data: marketMetadata, error: marketError } = await fetchMarketMetadata(conditionIds)
    if (marketError) {
      console.error('Failed to fetch market metadata', marketError)
    }

    const { marketMap, outcomeMap } = buildMarketLookups(marketMetadata ?? [])

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

async function fetchClobOpenOrders({
  auth,
  userAddress,
  makerAddress,
  id,
  market,
  assetId,
  nextCursor,
}: {
  auth: { key: string, secret: string, passphrase: string }
  userAddress: string
  makerAddress?: string
  id?: string
  market?: string
  assetId?: string
  nextCursor?: string
}): Promise<{ data: ClobOpenOrder[], next_cursor: string }> {
  const params = new URLSearchParams()
  if (makerAddress) {
    params.set('maker', makerAddress)
  }
  if (id) {
    params.set('id', id)
  }
  if (market) {
    params.set('market', market)
  }
  if (assetId) {
    params.set('asset_id', assetId)
  }
  if (nextCursor) {
    params.set('next_cursor', nextCursor)
  }
  const path = params.toString() ? `/data/orders?${params.toString()}` : '/data/orders'
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.secret, timestamp, 'GET', path)

  const response = await fetch(`${CLOB_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      KUEST_ADDRESS: userAddress,
      KUEST_API_KEY: auth.key,
      KUEST_PASSPHRASE: auth.passphrase,
      KUEST_TIMESTAMP: timestamp.toString(),
      KUEST_SIGNATURE: signature,
    },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = typeof payload?.error === 'string' ? payload.error : undefined
    throw new Error(message || `Failed to fetch open orders (status ${response.status})`)
  }

  const result = await response.json().catch(() => null)
  return normalizeClobOpenOrdersResponse(result)
}

async function fetchMarketMetadata(conditionIds: string[]) {
  if (!conditionIds.length) {
    return { data: [], error: null }
  }

  return runQuery(async () => {
    const rows = await db.query.markets.findMany({
      where: inArray(markets.condition_id, conditionIds),
      columns: {
        condition_id: true,
        title: true,
        slug: true,
        icon_url: true,
        is_active: true,
        is_resolved: true,
      },
      with: {
        event: {
          columns: {
            slug: true,
            title: true,
            icon_url: true,
          },
        },
        condition: {
          columns: { id: true },
          with: {
            outcomes: {
              columns: {
                token_id: true,
                outcome_text: true,
                outcome_index: true,
              },
            },
          },
        },
      },
    })

    const data = rows.map(row => ({
      condition_id: row.condition_id,
      title: row.title,
      slug: row.slug,
      icon_url: getSupabaseImageUrl(row.icon_url || row.event?.icon_url || ''),
      event_slug: row.event?.slug || '',
      event_title: row.event?.title || '',
      is_active: Boolean(row.is_active),
      is_resolved: Boolean(row.is_resolved),
      outcomes: (row.condition?.outcomes || []).map(outcome => ({
        token_id: outcome.token_id,
        outcome_text: outcome.outcome_text || '',
        outcome_index: Number(outcome.outcome_index || 0),
      })),
    }))

    return { data, error: null }
  })
}

function buildMarketLookups(marketsList: Array<{
  condition_id: string
  title: string
  slug: string
  icon_url?: string
  event_slug?: string
  event_title?: string
  is_active: boolean
  is_resolved: boolean
  outcomes: Array<{
    token_id: string
    outcome_text: string
    outcome_index: number
  }>
}>) {
  const marketMap = new Map<string, UserOpenOrder['market'] & {
    icon_url?: string
    event_slug?: string
    event_title?: string
  }>()
  const outcomeMap = new Map<string, { index: number, text: string }>()

  for (const market of marketsList) {
    const normalizedCondition = normalizeId(market.condition_id)
    marketMap.set(normalizedCondition, {
      condition_id: market.condition_id,
      title: market.title,
      slug: market.slug,
      is_active: market.is_active,
      is_resolved: market.is_resolved,
      icon_url: market.icon_url || undefined,
      event_slug: market.event_slug || undefined,
      event_title: market.event_title || undefined,
    })

    for (const outcome of market.outcomes) {
      const normalizedToken = normalizeId(outcome.token_id)
      if (normalizedToken) {
        outcomeMap.set(normalizedToken, {
          index: outcome.outcome_index,
          text: outcome.outcome_text || '',
        })
      }
    }
  }

  return { marketMap, outcomeMap }
}

function mapClobOrder(
  order: ClobOpenOrder,
  marketMap: Map<string, UserOpenOrder['market'] & { icon_url?: string, event_slug?: string, event_title?: string }>,
  outcomeMap: Map<string, { index: number, text: string }>,
): (UserOpenOrder & { market: UserOpenOrder['market'] & { icon_url?: string, event_slug?: string, event_title?: string } }) | null {
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
