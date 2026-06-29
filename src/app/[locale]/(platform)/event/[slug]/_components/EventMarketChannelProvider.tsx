'use client'

import type { MarketQuote, MarketQuotesByMarket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import type {
  OrderbookLevelSummary,
  OrderBookSummariesResponse,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { Market } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { closeWebSocketWhenReady, createWebSocketReconnectController } from '@/lib/websocket-reconnect'

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
const WEBSOCKET_PING_INTERVAL_MS = 10000
const WEBSOCKET_STALE_TIMEOUT_MS = 70000

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

function parseMarketQuoteTokenSignature(tokenSignature: string, tokenId: string) {
  return tokenSignature
    .split(',')
    .map((signaturePart) => {
      const separatorIndex = signaturePart.lastIndexOf(':')
      if (separatorIndex <= 0) {
        return null
      }

      const signatureConditionId = signaturePart.slice(0, separatorIndex)
      const signatureTokenId = signaturePart.slice(separatorIndex + 1)
      if (signatureTokenId !== tokenId) {
        return null
      }

      return signatureConditionId
    })
    .filter((conditionId): conditionId is string => Boolean(conditionId))
}

function updateMarketQuoteCachesForToken(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenId: string,
  quote: MarketQuote,
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['event-market-quotes'] })
  queries.forEach((query) => {
    const tokenSignature = typeof query.queryKey[2] === 'string'
      ? query.queryKey[2]
      : (typeof query.queryKey[1] === 'string' ? query.queryKey[1] : '')
    if (!tokenSignature) {
      return
    }

    const matchingConditionIds = parseMarketQuoteTokenSignature(tokenSignature, tokenId)
    if (matchingConditionIds.length === 0) {
      return
    }

    queryClient.setQueryData<MarketQuotesByMarket>(query.queryKey, (current) => {
      const existing = current ?? {}
      let didChange = false
      const next = { ...existing }

      for (const conditionId of matchingConditionIds) {
        const currentQuote = existing[conditionId]
        if (
          currentQuote
          && currentQuote.bid === quote.bid
          && currentQuote.ask === quote.ask
          && currentQuote.mid === quote.mid
        ) {
          continue
        }

        next[conditionId] = quote
        didChange = true
      }

      return didChange ? next : existing
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
  updateMarketQuoteCachesForToken(queryClient, tokenId, quote)
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

function useTokenMapping(markets: Market[]): TokenMapping {
  return useMemo(() => buildTokenMapping(markets), [markets])
}

function useMarketChannelConnection({
  tokenIds,
  tokenIdToConditionId,
  wsUrl,
  hasMarketChannel,
  queryClient,
}: {
  tokenIds: string[]
  tokenIdToConditionId: Map<string, string>
  wsUrl: string
  hasMarketChannel: boolean
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const listenersRef = useRef(new Set<MarketChannelListener>())
  const connectionStatusRef = useRef<MarketChannelStatus>('connecting')
  const connectionStatusListenersRef = useRef(new Set<() => void>())

  const subscribe = useCallback(function subscribeToMarketChannelListeners(listener: MarketChannelListener) {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  const subscribeToConnectionStatus = useCallback(function subscribeToConnectionStatus(listener: () => void) {
    connectionStatusListenersRef.current.add(listener)
    return () => connectionStatusListenersRef.current.delete(listener)
  }, [])

  const getConnectionStatusSnapshot = useCallback(
    function getConnectionStatusSnapshot() {
      return connectionStatusRef.current
    },
    [],
  )

  const connectionStatus = useSyncExternalStore(
    subscribeToConnectionStatus,
    getConnectionStatusSnapshot,
    getConnectionStatusSnapshot,
  )

  const setConnectionStatus = useCallback(function setMarketChannelConnectionStatus(status: MarketChannelStatus) {
    if (connectionStatusRef.current === status) {
      return
    }
    connectionStatusRef.current = status
    connectionStatusListenersRef.current.forEach((listener) => {
      listener()
    })
  }, [])

  useEffect(function establishMarketChannelConnection() {
    if (!hasMarketChannel) {
      return
    }

    let isActive = true
    let ws: WebSocket | null = null
    let lastMessageAt = Date.now()
    let heartbeatHandle: number | null = null

    function clearHeartbeat() {
      if (heartbeatHandle != null) {
        window.clearInterval(heartbeatHandle)
        heartbeatHandle = null
      }
    }

    function startHeartbeat() {
      clearHeartbeat()
      heartbeatHandle = window.setInterval(() => {
        if (!isActive || !ws) {
          return
        }
        if (Date.now() - lastMessageAt > WEBSOCKET_STALE_TIMEOUT_MS) {
          const staleSocket = ws
          ws = null
          clearHeartbeat()
          closeWebSocketWhenReady(staleSocket)
          scheduleReconnect()
          return
        }
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send('PING')
          }
          catch {
            const staleSocket = ws
            ws = null
            clearHeartbeat()
            closeWebSocketWhenReady(staleSocket)
            scheduleReconnect()
          }
        }
      }, WEBSOCKET_PING_INTERVAL_MS)
    }

    function handleOpen(socket: WebSocket) {
      if (socket !== ws) {
        return
      }
      lastMessageAt = Date.now()
      startHeartbeat()
      setConnectionStatus('connecting')
      socket.send(JSON.stringify({
        type: 'market',
        assets_ids: tokenIds,
        markets: [],
        custom_feature_enabled: true,
      }))
    }

    function handleMessage(socket: WebSocket, eventMessage: MessageEvent<string>) {
      if (!isActive || socket !== ws) {
        return
      }
      lastMessageAt = Date.now()
      setConnectionStatus('live')
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

    function handleError(socket: WebSocket) {
      if (isActive && socket === ws) {
        setConnectionStatus('offline')
      }
    }

    let reconnectController: ReturnType<typeof createWebSocketReconnectController> | null = null

    function clearReconnect() {
      reconnectController?.clearReconnect()
    }

    function handleVisibilityChange() {
      reconnectController?.handleVisibilityChange()
    }

    function scheduleReconnect() {
      reconnectController?.scheduleReconnect()
    }

    function handleClose(socket: WebSocket) {
      if (socket !== ws) {
        return
      }
      clearHeartbeat()
      if (isActive) {
        setConnectionStatus('offline')
        ws = null
        scheduleReconnect()
      }
    }

    function disconnectSocket(socket: WebSocket) {
      clearHeartbeat()
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      closeWebSocketWhenReady(socket)
    }

    function connect() {
      if (!isActive || ws || document.hidden) {
        return
      }
      setConnectionStatus('connecting')
      const socket = new WebSocket(`${wsUrl}/ws/market`)
      socket.onopen = () => handleOpen(socket)
      socket.onmessage = eventMessage => handleMessage(socket, eventMessage)
      socket.onerror = () => handleError(socket)
      socket.onclose = () => handleClose(socket)
      ws = socket
    }

    reconnectController = createWebSocketReconnectController({
      connect,
      disconnectWebSocket: disconnectSocket,
      getWebSocket: () => ws,
      isActive: () => isActive,
      reconnectOnVisible: true,
      resetWebSocket: () => {
        ws = null
      },
    })

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return function teardownMarketChannelConnection() {
      isActive = false
      clearReconnect()
      clearHeartbeat()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      const socket = ws
      if (socket) {
        disconnectSocket(socket)
      }
    }
  }, [hasMarketChannel, queryClient, setConnectionStatus, tokenIds, tokenIdToConditionId, wsUrl])

  const status: MarketChannelStatus = hasMarketChannel ? connectionStatus : 'offline'
  return { status, subscribe }
}

function EventMarketChannelProvider({
  markets,
  children,
}: {
  markets: Market[]
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const { wsClobUrl } = usePublicRuntimeConfig()
  const { tokenIds, tokenIdToConditionId } = useTokenMapping(markets)
  const wsUrl = wsClobUrl
  const hasMarketChannel = tokenIds.length > 0 && Boolean(wsUrl)

  const { status, subscribe } = useMarketChannelConnection({
    tokenIds,
    tokenIdToConditionId,
    wsUrl,
    hasMarketChannel,
    queryClient,
  })

  const contextValue = useMemo(() => ({ status, subscribe }), [status, subscribe])

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
  useEffect(function subscribeToMarketChannel() {
    return context.subscribe(listener)
  }, [context, listener])
}

export function useOptionalMarketChannelSubscription(listener: MarketChannelListener) {
  const context = use(MarketChannelContext)
  useEffect(function subscribeToOptionalMarketChannel() {
    return context?.subscribe(listener)
  }, [context, listener])
}

export default EventMarketChannelProvider
