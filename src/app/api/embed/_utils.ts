import type { NextResponse } from 'next/server'

import type { Event, Market, Outcome } from '@/types'

const FALLBACK_PRICE = 0.5

function clampPrice(value: number) {
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function normalizeOutcomePrice(outcome: Outcome) {
  const buy = typeof outcome.buy_price === 'number' ? outcome.buy_price : undefined
  const sell = typeof outcome.sell_price === 'number' ? outcome.sell_price : undefined
  const fallback = buy ?? sell ?? FALLBACK_PRICE
  const mid = ((buy ?? fallback) + (sell ?? fallback)) / 2
  return clampPrice(Number.isFinite(mid) ? mid : FALLBACK_PRICE)
}

function normalizeOutcomes(outcomes: Outcome[]) {
  return [...outcomes].sort((a, b) => (a.outcome_index ?? 0) - (b.outcome_index ?? 0))
}

export function withEmbedCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

export function buildEmbedMarket(market: Market, event?: Event) {
  const normalizedOutcomes = normalizeOutcomes(market.outcomes ?? [])
  const outcomeLabels = normalizedOutcomes.map((outcome) => outcome.outcome_text || '')
  const outcomePrices = normalizedOutcomes.map((outcome) => normalizeOutcomePrice(outcome))
  const tokenIds = normalizedOutcomes.map((outcome) => outcome.token_id).filter(Boolean)
  const iconUrl = market.icon_url || event?.icon_url || ''
  const endDateIso = market.end_time ?? event?.end_date ?? null

  return {
    slug: market.slug,
    question: market.question || market.title || market.slug,
    image: iconUrl,
    imageOptimized: {
      imageUrlSource: iconUrl,
    },
    outcomes: JSON.stringify(outcomeLabels),
    outcomePrices: JSON.stringify(outcomePrices),
    clobTokenIds: tokenIds.length > 0 ? JSON.stringify(tokenIds) : null,
    events: event?.slug ? [{ slug: event.slug }] : [],
    volumeNum: Number(market.volume ?? 0),
    oneDayPriceChange: 0,
    endDateIso,
    active: Boolean(market.is_active),
    closed: Boolean(market.is_resolved),
  }
}

export function buildEmbedEvent(event: Event) {
  return {
    slug: event.slug,
    title: event.title,
    icon: event.icon_url,
    volume: Number(event.volume ?? 0),
    markets: event.markets.map((market) => buildEmbedMarket(market, event)),
  }
}
