'use client'

import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import type { MarketQuote, MarketQuotesByMarket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import type {
  OrderbookLevelSummary,
  OrderBookSummariesResponse,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { Market } from '@/types'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import {
  closeWebSocketWhenReady,
  createWebSocketHeartbeatController,
  createWebSocketReconnectController,
} from '@/lib/websocket-reconnect'

type MarketChannelStatus = 'connecting' | 'live' | 'offline'
type MarketChannelListener = (payload: any) => void

interface MarketChannelContextValue {
  status: MarketChannelStatus
  subscribe: (listener: MarketChannelListener) => () => void
}

interface MarketChannelLiveVolumeContextValue {
  liveVolumeByCondition: Record<string, number>
  resetLiveVolumes: () => void
}

interface TokenMapping {
  tokenIds: string[]
  tokenIdToConditionId: Map<string, string>
}

interface LiveVolumeState {
  tokenIdsSignature: string
  byCondition: Record<string, number>
}

const MarketChannelContext = createContext<MarketChannelContextValue | null>(null)
const MarketChannelLiveVolumeContext = createContext<MarketChannelLiveVolumeContextValue | null>(null)
const EMPTY_LIVE_VOLUME_CONTEXT: MarketChannelLiveVolumeContextValue = {
  liveVolumeByCondition: {},
  resetLiveVolumes: () => {},
}
const WEBSOCKET_PING_INTERVAL_MS = 10000
const LIVE_VOLUME_FLUSH_INTERVAL_MS = 100
const MAX_SEEN_LIVE_TRADE_KEYS = 4096

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
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN

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
  const mid = bid != null && ask != null ? (bid + ask) / 2 : (ask ?? bid ?? null)

  return { bid, ask, mid }
}

export function resolveLiveTradeVolume(
  payload: unknown,
  tokenIdToConditionId: Map<string, string>,
): { conditionId: string; volume: number } | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const record = payload as Record<string, unknown>
  if (record.event_type !== 'last_trade_price') {
    return null
  }

  const assetId = typeof record.asset_id === 'string' ? record.asset_id : ''
  const conditionId = tokenIdToConditionId.get(assetId)
  if (!conditionId) {
    return null
  }

  const price = Number(record.price)
  const size = Number(record.size)
  const volume = price * size
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0 || !Number.isFinite(volume)) {
    return null
  }

  return { conditionId, volume }
}

export function resolveLiveTradeEventKey(payload: unknown, tokenIdToConditionId: Map<string, string>) {
  const trade = resolveLiveTradeVolume(payload, tokenIdToConditionId)
  if (!trade || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const record = payload as Record<string, unknown>
  const assetId = typeof record.asset_id === 'string' ? record.asset_id : ''
  const sequence = record.sequence
  const streamId = record.stream_id
  const tradeId = [record.trade_id, record.tradeId, record.id].find(
    (value): value is string | number =>
      (typeof value === 'string' && value.trim().length > 0) || typeof value === 'number',
  )
  const hasSequence = (typeof sequence === 'string' && sequence.trim().length > 0) || typeof sequence === 'number'
  const hasStreamId = (typeof streamId === 'string' && streamId.trim().length > 0) || typeof streamId === 'number'
  if (hasSequence) {
    return hasStreamId
      ? [trade.conditionId, 'stream', String(streamId), String(sequence), assetId].join(':')
      : [trade.conditionId, 'stream', String(sequence), assetId].join(':')
  }
  if (tradeId !== undefined || hasStreamId) {
    return [trade.conditionId, 'stream', hasStreamId ? String(streamId) : '', String(tradeId ?? ''), assetId].join(':')
  }

  const timestamp = Number(record.timestamp)
  if (!assetId || !Number.isFinite(timestamp)) {
    return null
  }

  const side = typeof record.side === 'string' ? record.side.toUpperCase() : ''
  return [trade.conditionId, assetId, timestamp, Number(record.price), Number(record.size), side].join(':')
}

export function accumulateLiveTradeVolume(
  current: Record<string, number>,
  payload: unknown,
  tokenIdToConditionId: Map<string, string>,
) {
  const trade = resolveLiveTradeVolume(payload, tokenIdToConditionId)
  if (!trade) {
    return current
  }

  return {
    ...current,
    [trade.conditionId]: (current[trade.conditionId] ?? 0) + trade.volume,
  }
}

function updateOrderBookCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  tokenId: string,
  updater: (current: OrderBookSummariesResponse | undefined) => OrderBookSummariesResponse,
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['orderbook-summary'] })
  queries.forEach((query) => {
    const tokenIdsKey = typeof query.queryKey[2] === 'string' ? query.queryKey[2] : ''
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
    const tokenSignature =
      typeof query.queryKey[2] === 'string'
        ? query.queryKey[2]
        : typeof query.queryKey[1] === 'string'
          ? query.queryKey[1]
          : ''
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
          currentQuote &&
          currentQuote.bid === quote.bid &&
          currentQuote.ask === quote.ask &&
          currentQuote.mid === quote.mid
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
  const lastTradePrice =
    typeof price === 'string' ? price : typeof price === 'number' && Number.isFinite(price) ? String(price) : ''
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
  const tokenIdsSignature = tokenIds.join(',')
  const [liveVolumeState, setLiveVolumeState] = useState<LiveVolumeState>(() => ({
    tokenIdsSignature,
    byCondition: {},
  }))
  const pendingLiveVolumeRef = useRef<Record<string, number>>({})
  const liveVolumeFlushTimerRef = useRef<number | null>(null)
  const seenLiveTradeKeysRef = useRef<{ tokenIdsSignature: string; keys: Set<string> }>({
    tokenIdsSignature,
    keys: new Set(),
  })
  const liveVolumeByCondition =
    liveVolumeState.tokenIdsSignature === tokenIdsSignature
      ? liveVolumeState.byCondition
      : EMPTY_LIVE_VOLUME_CONTEXT.liveVolumeByCondition

  const clearPendingLiveVolume = useCallback(() => {
    pendingLiveVolumeRef.current = {}
    if (liveVolumeFlushTimerRef.current !== null) {
      window.clearTimeout(liveVolumeFlushTimerRef.current)
      liveVolumeFlushTimerRef.current = null
    }
  }, [])

  const flushPendingLiveVolume = useCallback(() => {
    liveVolumeFlushTimerRef.current = null
    const pending = pendingLiveVolumeRef.current
    pendingLiveVolumeRef.current = {}

    if (Object.keys(pending).length === 0) {
      return
    }

    setLiveVolumeState((current) => {
      const byCondition =
        current.tokenIdsSignature === tokenIdsSignature
          ? current.byCondition
          : EMPTY_LIVE_VOLUME_CONTEXT.liveVolumeByCondition
      const next = { ...byCondition }

      for (const [conditionId, volume] of Object.entries(pending)) {
        next[conditionId] = (next[conditionId] ?? 0) + volume
      }

      return { tokenIdsSignature, byCondition: next }
    })
  }, [tokenIdsSignature])

  const resetLiveVolumes = useCallback(() => {
    clearPendingLiveVolume()
    seenLiveTradeKeysRef.current = { tokenIdsSignature, keys: new Set() }
    setLiveVolumeState((current) => {
      if (current.tokenIdsSignature !== tokenIdsSignature || Object.keys(current.byCondition).length === 0) {
        return current
      }

      return { tokenIdsSignature, byCondition: {} }
    })
  }, [clearPendingLiveVolume, tokenIdsSignature])

  const addLiveTradeVolume = useCallback(
    (payload: unknown) => {
      const trade = resolveLiveTradeVolume(payload, tokenIdToConditionId)
      if (!trade) {
        return
      }

      if (seenLiveTradeKeysRef.current.tokenIdsSignature !== tokenIdsSignature) {
        seenLiveTradeKeysRef.current = { tokenIdsSignature, keys: new Set() }
      }

      const eventKey = resolveLiveTradeEventKey(payload, tokenIdToConditionId)
      if (eventKey) {
        if (seenLiveTradeKeysRef.current.keys.has(eventKey)) {
          return
        }
        seenLiveTradeKeysRef.current.keys.add(eventKey)
        while (seenLiveTradeKeysRef.current.keys.size > MAX_SEEN_LIVE_TRADE_KEYS) {
          const oldestKey = seenLiveTradeKeysRef.current.keys.values().next().value
          if (oldestKey === undefined) {
            break
          }
          seenLiveTradeKeysRef.current.keys.delete(oldestKey)
        }
      }

      pendingLiveVolumeRef.current[trade.conditionId] =
        (pendingLiveVolumeRef.current[trade.conditionId] ?? 0) + trade.volume

      if (liveVolumeFlushTimerRef.current === null) {
        liveVolumeFlushTimerRef.current = window.setTimeout(flushPendingLiveVolume, LIVE_VOLUME_FLUSH_INTERVAL_MS)
      }
    },
    [flushPendingLiveVolume, tokenIdToConditionId, tokenIdsSignature],
  )

  useEffect(() => clearPendingLiveVolume, [clearPendingLiveVolume, tokenIdsSignature])

  const subscribe = useCallback(function subscribeToMarketChannelListeners(listener: MarketChannelListener) {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  const subscribeToConnectionStatus = useCallback(function subscribeToConnectionStatus(listener: () => void) {
    connectionStatusListenersRef.current.add(listener)
    return () => connectionStatusListenersRef.current.delete(listener)
  }, [])

  const getConnectionStatusSnapshot = useCallback(function getConnectionStatusSnapshot() {
    return connectionStatusRef.current
  }, [])

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

  useEffect(
    function establishMarketChannelConnection() {
      if (!hasMarketChannel) {
        return
      }

      let isActive = true
      let ws: WebSocket | null = null

      function handleOpen(socket: WebSocket) {
        if (socket !== ws) {
          return
        }
        reconnectController?.markConnected()
        heartbeatController?.markOpen(socket)
        setConnectionStatus('connecting')
        socket.send(
          JSON.stringify({
            type: 'market',
            assets_ids: tokenIds,
            markets: [],
            custom_feature_enabled: true,
          }),
        )
      }

      function handleMessage(socket: WebSocket, eventMessage: MessageEvent<string>) {
        if (!isActive || socket !== ws) {
          return
        }
        heartbeatController?.markActivity(socket)
        setConnectionStatus('live')
        let payload: any
        try {
          payload = JSON.parse(eventMessage.data)
        } catch {
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
          addLiveTradeVolume(payload)
        }

        if (payload?.event_type === 'best_bid_ask') {
          const tokenId = String(payload.asset_id ?? '')
          if (tokenId) {
            updateQuotesFromBestBidAsk(queryClient, tokenIdToConditionId, tokenId, payload.best_bid, payload.best_ask)
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
      let heartbeatController: ReturnType<typeof createWebSocketHeartbeatController> | null = null

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
        heartbeatController?.clear()
        if (isActive) {
          setConnectionStatus('offline')
          ws = null
          scheduleReconnect()
        }
      }

      function disconnectSocket(socket: WebSocket) {
        heartbeatController?.clear()
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
        socket.onmessage = (eventMessage) => handleMessage(socket, eventMessage)
        socket.onerror = () => handleError(socket)
        socket.onclose = () => handleClose(socket)
        ws = socket
        heartbeatController?.markConnecting(socket)
      }

      reconnectController = createWebSocketReconnectController({
        connect,
        getWebSocket: () => ws,
        isActive: () => isActive,
        resetWebSocket: () => {
          heartbeatController?.clear()
          ws = null
        },
      })
      heartbeatController = createWebSocketHeartbeatController({
        getWebSocket: () => ws,
        isActive: () => isActive,
        onConnectionLost: (socket) => {
          ws = null
          setConnectionStatus('offline')
          closeWebSocketWhenReady(socket)
          scheduleReconnect()
        },
        pingIntervalMs: WEBSOCKET_PING_INTERVAL_MS,
      })

      connect()
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return function teardownMarketChannelConnection() {
        isActive = false
        clearReconnect()
        heartbeatController.clear()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        const socket = ws
        if (socket) {
          disconnectSocket(socket)
        }
      }
    },
    [addLiveTradeVolume, hasMarketChannel, queryClient, setConnectionStatus, tokenIds, tokenIdToConditionId, wsUrl],
  )

  const status: MarketChannelStatus = hasMarketChannel ? connectionStatus : 'offline'
  return { status, subscribe, liveVolumeByCondition, resetLiveVolumes }
}

function EventMarketChannelProvider({ markets, children }: { markets: Market[]; children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { wsClobUrl } = usePublicRuntimeConfig()
  const { tokenIds, tokenIdToConditionId } = useTokenMapping(markets)
  const wsUrl = wsClobUrl
  const hasMarketChannel = tokenIds.length > 0 && Boolean(wsUrl)

  const { status, subscribe, liveVolumeByCondition, resetLiveVolumes } = useMarketChannelConnection({
    tokenIds,
    tokenIdToConditionId,
    wsUrl,
    hasMarketChannel,
    queryClient,
  })

  const contextValue = useMemo(() => ({ status, subscribe }), [status, subscribe])
  const liveVolumeContextValue = useMemo(
    () => ({ liveVolumeByCondition, resetLiveVolumes }),
    [liveVolumeByCondition, resetLiveVolumes],
  )

  return (
    <MarketChannelContext value={contextValue}>
      <MarketChannelLiveVolumeContext value={liveVolumeContextValue}>{children}</MarketChannelLiveVolumeContext>
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
  useEffect(
    function subscribeToMarketChannel() {
      return context.subscribe(listener)
    },
    [context, listener],
  )
}

export function useOptionalMarketChannelSubscription(listener: MarketChannelListener) {
  const context = use(MarketChannelContext)
  useEffect(
    function subscribeToOptionalMarketChannel() {
      return context?.subscribe(listener)
    },
    [context, listener],
  )
}

export function useOptionalMarketChannelLiveVolumes(): MarketChannelLiveVolumeContextValue {
  const context = use(MarketChannelLiveVolumeContext)
  return context ?? EMPTY_LIVE_VOLUME_CONTEXT
}

export default EventMarketChannelProvider
