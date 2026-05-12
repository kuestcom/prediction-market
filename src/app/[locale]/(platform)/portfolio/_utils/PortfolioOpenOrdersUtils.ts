import type { PortfolioOpenOrdersSort, PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { MICRO_UNIT } from '@/lib/constants'

export function formatCents(price?: number) {
  return `${Math.round((price ?? 0) * 100)}¢`
}

export function microToUnit(value?: number) {
  return Number.isFinite(value) ? (value ?? 0) / MICRO_UNIT : 0
}

export function formatExpirationLabel(order: PortfolioUserOpenOrder) {
  if (order.type === 'GTC') {
    return 'Until Cancelled'
  }

  const rawExpiration = typeof order.expiration === 'number'
    ? order.expiration
    : Number(order.expiration)

  if (!Number.isFinite(rawExpiration) || rawExpiration <= 0) {
    return '—'
  }

  const date = new Date(rawExpiration * 1000)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function matchesOpenOrdersSearchQuery(order: PortfolioUserOpenOrder, searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase()
  if (!trimmed) {
    return true
  }

  const marketTitle = order.market.title?.toLowerCase() ?? ''
  const eventTitle = order.market.event_title?.toLowerCase() ?? ''
  const outcomeText = order.outcome.text?.toLowerCase() ?? ''
  const orderId = order.id?.toLowerCase() ?? ''
  return (
    marketTitle.includes(trimmed)
    || eventTitle.includes(trimmed)
    || outcomeText.includes(trimmed)
    || orderId.includes(trimmed)
  )
}

export function resolveOpenOrdersSearchParams(searchQuery: string) {
  const trimmed = searchQuery.trim()
  if (!trimmed) {
    return {}
  }

  const upper = trimmed.toUpperCase()
  const isUlid = /^[0-9A-HJKMNP-TV-Z]{26}$/.test(upper)
  if (isUlid) {
    return { id: trimmed }
  }

  const normalized = trimmed.toLowerCase()
  if (normalized.startsWith('0x')) {
    if (normalized.includes(':')) {
      return { assetId: trimmed }
    }
    if (normalized.length === 66) {
      return { market: trimmed }
    }
  }

  return {}
}

export function getOrderTotalShares(order: PortfolioUserOpenOrder) {
  return order.side === 'buy'
    ? microToUnit(order.taker_amount)
    : microToUnit(order.maker_amount)
}

export function getOrderFilledShares(order: PortfolioUserOpenOrder) {
  return microToUnit(order.size_matched)
}

function getOrderCreatedAtMs(order: PortfolioUserOpenOrder) {
  const parsed = Date.parse(order.created_at)
  return Number.isFinite(parsed) ? parsed : 0
}

function getOrderExpirationSeconds(order: PortfolioUserOpenOrder) {
  if (order.type === 'GTC') {
    return Number.POSITIVE_INFINITY
  }

  const rawExpiration = typeof order.expiration === 'number'
    ? order.expiration
    : Number(order.expiration)

  if (!Number.isFinite(rawExpiration) || rawExpiration <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return rawExpiration
}

export function sortOpenOrders(orders: PortfolioUserOpenOrder[], sortBy: PortfolioOpenOrdersSort) {
  const sorted = [...orders]

  sorted.sort((a, b) => {
    if (sortBy === 'market') {
      return (a.market.title || '').localeCompare(b.market.title || '', undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'filled') {
      return getOrderFilledShares(b) - getOrderFilledShares(a)
    }
    if (sortBy === 'total') {
      return getOrderTotalShares(b) - getOrderTotalShares(a)
    }
    if (sortBy === 'date') {
      return getOrderCreatedAtMs(b) - getOrderCreatedAtMs(a)
    }
    if (sortBy === 'resolving') {
      return getOrderExpirationSeconds(a) - getOrderExpirationSeconds(b)
    }
    return 0
  })

  return sorted
}
