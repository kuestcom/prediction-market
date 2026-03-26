import type { ClobOrderType, UserOpenOrder } from '@/types'
import { MICRO_UNIT } from '@/lib/constants'

interface ClobOpenOrderLike {
  asset_id?: string | null
  created_at: string
  expiration?: string | number | null
  id: string
  market?: string | null
  original_size?: string | number | null
  outcome?: string | null
  price?: string | number | null
  side?: string | null
  size_matched?: string | number | null
  status?: string | null
  type?: string | null
}

export interface OpenOrderOutcomeMeta {
  index: number
  text: string
}

export function normalizeClobOrderType(value?: string | null): ClobOrderType {
  switch (value) {
    case 'FAK':
    case 'FOK':
    case 'GTD':
    case 'GTC':
      return value
    default:
      return 'GTC'
  }
}

export function mapClobOpenOrder<TMarket extends UserOpenOrder['market'], TOrder extends ClobOpenOrderLike>(
  order: TOrder,
  marketMap: Map<string, TMarket>,
  outcomeMap: Map<string, OpenOrderOutcomeMeta>,
): (UserOpenOrder & { market: TMarket }) | null {
  const marketMeta = marketMap.get(normalizeClobId(order.market))
  if (!marketMeta) {
    return null
  }

  const outcomeMeta = resolveClobOrderOutcome(order, outcomeMap)
  const side = order.side === 'SELL' ? 'sell' : 'buy'
  const priceValue = clampClobNumber(parseClobNumber(order.price), 0, 1)
  const totalShares = Math.max(parseClobNumber(order.original_size), 0)
  const filledShares = Math.max(parseClobNumber(order.size_matched), 0)
  const { makerAmount, takerAmount } = calculateClobAmounts(totalShares, priceValue, side)
  const expiry = order.expiration == null || order.expiration === ''
    ? null
    : parseClobNumber(order.expiration)

  return {
    id: order.id,
    side,
    type: normalizeClobOrderType(order.type),
    status: order.status || 'live',
    price: priceValue,
    maker_amount: makerAmount,
    taker_amount: takerAmount,
    size_matched: Math.round(filledShares * MICRO_UNIT),
    created_at: order.created_at,
    expiration: typeof expiry === 'number' && Number.isFinite(expiry) ? expiry : null,
    outcome: {
      index: outcomeMeta?.index ?? 0,
      text: outcomeMeta?.text || '',
    },
    market: marketMeta,
  }
}

export function resolveClobOrderOutcome<TOrder extends Pick<ClobOpenOrderLike, 'asset_id' | 'outcome'>>(
  order: TOrder,
  outcomeMap: Map<string, OpenOrderOutcomeMeta>,
) {
  const candidates = [order.asset_id, order.outcome]

  for (const candidate of candidates) {
    const normalized = normalizeClobId(candidate)
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

export function calculateClobAmounts(totalShares: number, price: number, side: 'buy' | 'sell') {
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

export function normalizeClobId(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function parseClobNumber(value?: string | number | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function clampClobNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

export function normalizeClobOpenOrdersResponse<TOrder>(result: unknown) {
  if (Array.isArray(result)) {
    return { data: result as TOrder[], next_cursor: 'LTE=' }
  }

  if (result && typeof result === 'object') {
    const data = Array.isArray((result as { data?: unknown }).data)
      ? (result as { data: TOrder[] }).data
      : []
    const next_cursor = typeof (result as { next_cursor?: unknown }).next_cursor === 'string'
      ? (result as { next_cursor: string }).next_cursor
      : 'LTE='

    return { data, next_cursor }
  }

  return { data: [] as TOrder[], next_cursor: 'LTE=' }
}
