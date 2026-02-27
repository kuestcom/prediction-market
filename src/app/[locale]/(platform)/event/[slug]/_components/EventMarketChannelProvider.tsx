'use client'

import type { MarketQuote, MarketQuotesByMarket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import type {
  OrderbookLevelSummary,
  OrderBookSummariesResponse,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { Market } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'

type MarketChannelStatus = 'connecting' | 'live' | 'offline'
type MarketChannelListener = (payload: any) => void

interface MarketChannelContextValue {
  status: MarketChannelStatus
  subscribe: (listener: MarketChannelListener) => () => void
}

interface TokenMapping {
  tokenIds: string[]
  tokenIdToConditionId: Map<string, string>
}

const MarketChannelContext = createContext<MarketChannelContextValue | null>(null)

function buildTokenMapping(markets: Market[]): TokenMapping {
  const tokenIds: string[] = []
  const tokenIdToConditionId = new Map<string, string>()

  markets.forEach((market) => {
    const conditionId = market.condition_id
    if (!conditionId) {
      return
    }
    market.outcomes.forEach((outcome) => {
      if (!outcome.token_id) {
        return
      }
      const tokenId = String(outcome.token_id)
      tokenIds.push(tokenId)
      tokenIdToConditionId.set(tokenId, conditionId)
    })
  })

  tokenIds.sort()

  return {
    tokenIds: Array.from(new Set(tokenIds)),
    tokenIdToConditionId,
  }
}

function normalizePrice(value: unknown) {
  const parsed = typeof value === 'string' || typeof value === 'number'
    ? Number(value)
    : Number.NaN

  if (!Number.isFinite(parsed)) {
    return null
  }
  if (parsed < 0) {
    return 0
  }
  if (parsed > 1) {
    return 1
  }
  return parsed
}

function resolveQuote(bestBid: unknown, bestAsk: unknown): MarketQuote {
  const bid = normalizePrice(bestBid)
  const ask = normalizePrice(bestAsk)
  const mid = bid != null && ask != null
    ? (bid + ask) / 2
    : (ask ?? bid ?? null)

  return { bid, ask, mid }
}

function updateOrderBookCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenId: string,
  updater: (current: OrderBookSummariesResponse | undefined) => OrderBookSummariesResponse,
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['orderbook-summary'] })
  queries.forEach((query) => {
    const tokenIdsKey = typeof query.queryKey[1] === 'string' ? query.queryKey[1] : ''
    const tokenIds = tokenIdsKey ? tokenIdsKey.split(',') : []
    if (!tokenIds.includes(tokenId)) {
      return
    }
    queryClient.setQueryData<OrderBookSummariesResponse>(query.queryKey, updater)
  })
}

function updateQuoteCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  signature: string,
  conditionId: string,
  quote: MarketQuote,
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['event-market-quotes'] })
  queries.forEach((query) => {
    const tokenSignature = typeof query.queryKey[1] === 'string' ? query.queryKey[1] : ''
    if (!tokenSignature || !tokenSignature.includes(signature)) {
      return
    }
    queryClient.setQueryData<MarketQuotesByMarket>(query.queryKey, (current) => {
      const existing = current ?? {}
      const currentQuote = existing[conditionId]
      if (
        currentQuote
        && currentQuote.bid === quote.bid
        && currentQuote.ask === quote.ask
        && currentQuote.mid === quote.mid
      ) {
        return existing
      }
      return { ...existing, [conditionId]: quote }
    })
  })
}

function updateOrderBookFromBook(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenId: string,
  bids: unknown,
  asks: unknown,
) {
  const nextBids = coerceBookLevels(bids)
  const nextAsks = coerceBookLevels(asks)

  updateOrderBookCaches(queryClient, tokenId, (current) => {
    const existing = current ?? {}
    const previous = existing[tokenId]
    const nextEntry = {
      bids: nextBids,
      asks: nextAsks,
      last_trade_price: previous?.last_trade_price,
      last_trade_side: previous?.last_trade_side,
    }
    return { ...existing, [tokenId]: nextEntry }
  })
}

function updateOrderBookFromLastTrade(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenId: string,
  price: unknown,
  side: unknown,
) {
  const lastTradePrice = typeof price === 'string' ? price : String(price ?? '')
  const lastTradeSide = side === 'BUY' || side === 'SELL' ? side : undefined

  updateOrderBookCaches(queryClient, tokenId, (current) => {
    const existing = current ?? {}
    const previous = existing[tokenId]
    const nextEntry = {
      bids: previous?.bids ?? [],
      asks: previous?.asks ?? [],
      last_trade_price: lastTradePrice || previous?.last_trade_price,
      last_trade_side: lastTradeSide ?? previous?.last_trade_side,
    }
    return { ...existing, [tokenId]: nextEntry }
  })
}

function updateQuotesFromBestBidAsk(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenIdToConditionId: Map<string, string>,
  tokenId: string,
  bestBid: unknown,
  bestAsk: unknown,
) {
  const conditionId = tokenIdToConditionId.get(tokenId)
  if (!conditionId) {
    return
  }
  const quote = resolveQuote(bestBid, bestAsk)
  const signature = `${conditionId}:${tokenId}`
  updateQuoteCaches(queryClient, signature, conditionId, quote)
}

function coerceBookLevels(value: unknown): OrderbookLevelSummary[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const price = (entry as { price?: unknown }).price
      const size = (entry as { size?: unknown }).size
      if (typeof price !== 'string' || typeof size !== 'string') {
        return null
      }
      return { price, size }
    })
    .filter((entry): entry is OrderbookLevelSummary => entry !== null)
}

function EventMarketChannelProvider({
  markets,
  children,
}: {
  markets: Market[]
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const listenersRef = useRef(new Set<MarketChannelListener>())
  const [status, setStatus] = useState<MarketChannelStatus>('connecting')
  const { tokenIds, tokenIdToConditionId } = useMemo(
    () => buildTokenMapping(markets),
    [markets],
  )
  const wsUrl = process.env.WS_CLOB_URL!

  useEffect(() => {
    if (!tokenIds.length || !wsUrl) {
      setStatus('offline')
      return
    }

    let isActive = true
    let ws: WebSocket | null = null
    let reconnectTimeout: number | null = null

    function handleOpen() {
      if (!ws) {
        return
      }
      setStatus('connecting')
      ws.send(JSON.stringify({
        type: 'market',
        assets_ids: tokenIds,
        markets: [],
        custom_feature_enabled: true,
      }))
    }

    function handleMessage(eventMessage: MessageEvent<string>) {
      if (!isActive) {
        return
      }
      setStatus('live')
      let payload: any
      try {
        payload = JSON.parse(eventMessage.data)
      }
      catch {
        return
      }

      if (payload?.event_type === 'book') {
        const tokenId = String(payload.asset_id ?? '')
        if (tokenId) {
          updateOrderBookFromBook(queryClient, tokenId, payload.bids, payload.asks)
        }
      }

      if (payload?.event_type === 'last_trade_price') {
        const tokenId = String(payload.asset_id ?? '')
        if (tokenId) {
          updateOrderBookFromLastTrade(queryClient, tokenId, payload.price, payload.side)
        }
      }

      if (payload?.event_type === 'best_bid_ask') {
        const tokenId = String(payload.asset_id ?? '')
        if (tokenId) {
          updateQuotesFromBestBidAsk(
            queryClient,
            tokenIdToConditionId,
            tokenId,
            payload.best_bid,
            payload.best_ask,
          )
        }
      }

      listenersRef.current.forEach((listener) => {
        listener(payload)
      })
    }

    function handleError() {
      if (isActive) {
        setStatus('offline')
      }
    }

    function handleClose() {
      if (isActive) {
        setStatus('offline')
        scheduleReconnect()
      }
    }

    function connect() {
      if (!isActive || ws || document.hidden) {
        return
      }
      setStatus('connecting')
      ws = new WebSocket(`${wsUrl}/ws/market`)
      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    }

    function clearReconnect() {
      if (reconnectTimeout != null) {
        window.clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    function scheduleReconnect() {
      clearReconnect()
      reconnectTimeout = window.setTimeout(() => {
        if (!isActive) {
          return
        }
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }, 1500)
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      clearReconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (ws) {
        ws.removeEventListener('open', handleOpen)
        ws.removeEventListener('message', handleMessage)
        ws.removeEventListener('error', handleError)
        ws.removeEventListener('close', handleClose)
        ws.close()
      }
    }
  }, [queryClient, tokenIds, tokenIdToConditionId, wsUrl])

  const contextValue = useMemo(
    () => ({
      status,
      subscribe(listener: MarketChannelListener) {
        listenersRef.current.add(listener)
        return () => listenersRef.current.delete(listener)
      },
    }),
    [status],
  )

  return (
    <MarketChannelContext value={contextValue}>
      {children}
    </MarketChannelContext>
  )
}

export function useMarketChannelStatus() {
  const context = use(MarketChannelContext)
  if (!context) {
    throw new Error('useMarketChannelStatus must be used within EventMarketChannelProvider')
  }
  return context.status
}

export function useMarketChannelSubscription(listener: MarketChannelListener) {
  const context = use(MarketChannelContext)
  if (!context) {
    throw new Error('useMarketChannelSubscription must be used within EventMarketChannelProvider')
  }
  useEffect(() => {
    return context.subscribe(listener)
  }, [context, listener])
}

export function useOptionalMarketChannelSubscription(listener: MarketChannelListener) {
  const context = use(MarketChannelContext)
  useEffect(() => {
    if (!context) {
      return
    }
    return context.subscribe(listener)
  }, [context, listener])
}

export default EventMarketChannelProvider
