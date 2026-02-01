'use client'

import type { MergeableMarket } from './MergePositionsDialog'
import type { PublicPosition } from './PublicPositionItem'
import type { SortDirection, SortOption } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { useMergePositionsAction } from '@/app/[locale]/(platform)/[username]/_hooks/useMergePositionsAction'
import { usePublicPositionsQuery } from '@/app/[locale]/(platform)/[username]/_hooks/usePublicPositionsQuery'
import {
  buildMergeableMarkets,
  calculatePositionsTotals,
  fetchLockedSharesByCondition,
  getDefaultSortDirection,
  getOutcomeLabel,
  matchesPositionsSearchQuery,
  sortPositions,
} from '@/app/[locale]/(platform)/[username]/_utils/PublicPositionsUtils'
import { PositionShareDialog } from '@/app/[locale]/(platform)/_components/PositionShareDialog'
import SellPositionModal from '@/app/[locale]/(platform)/_components/SellPositionModal'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { handleOrderCancelledFeedback, handleOrderErrorFeedback, handleOrderSuccessFeedback, handleValidationError, notifyWalletApprovalPrompt } from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'
import { calculateMarketFill, normalizeBookLevels } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderPanelUtils'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useDebounce } from '@/hooks/useDebounce'
import { getExchangeEip712Domain, ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchOrderBookSummary } from '@/lib/event-card-orderbook'
import { formatAmountInputValue, formatCentsLabel } from '@/lib/formatters'
import { buildOrderPayload, submitOrder } from '@/lib/orders'
import { signOrderPayload } from '@/lib/orders/signing'
import { buildShareCardPayload } from '@/lib/share-card'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'
import { MergePositionsDialog } from './MergePositionsDialog'
import PublicPositionsFilters from './PublicPositionsFilters'
import PublicPositionsTable from './PublicPositionsTable'

interface PublicPositionsListProps {
  userAddress: string
}

export default function PublicPositionsList({ userAddress }: PublicPositionsListProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { open, close } = useAppKit()
  const { isConnected, embeddedWalletInfo } = useAppKitAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const user = useUser()
  const { signMessageAsync } = useSignMessage()
  const hasDeployedProxyWallet = Boolean(user?.proxy_wallet_address && user?.proxy_wallet_status === 'deployed')
  const proxyWalletAddress = hasDeployedProxyWallet ? normalizeAddress(user?.proxy_wallet_address) : null
  const userAddressNormalized = normalizeAddress(user?.address)
  const makerAddress = proxyWalletAddress ?? null
  const signatureType = proxyWalletAddress ? 2 : 0
  const canSell = Boolean(
    hasDeployedProxyWallet
    && user?.proxy_wallet_address
    && user.proxy_wallet_address.toLowerCase() === userAddress.toLowerCase(),
  )

  const marketStatusFilter: 'active' | 'closed' = 'active'
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortBy, setSortBy] = useState<SortOption>('currentValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => getDefaultSortDirection('currentValue'))
  const minAmountFilter = 'All'
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [mergeSuccess, setMergeSuccess] = useState(false)
  const [hideMergeButton, setHideMergeButton] = useState(false)
  const [hiddenMergeSignature, setHiddenMergeSignature] = useState<string | null>(null)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [sharePosition, setSharePosition] = useState<PublicPosition | null>(null)
  const [availableMergeableMarkets, setAvailableMergeableMarkets] = useState<MergeableMarket[]>([])
  const [sellModalPayload, setSellModalPayload] = useState<{
    position: PublicPosition
    shares: number
    filledShares: number | null
    avgPriceCents: number | null
    limitPriceCents: number | null
    receiveAmount: number | null
    tokenId: string | null
    isNegRisk: boolean
  } | null>(null)
  const [isCashOutSubmitting, setIsCashOutSubmitting] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const sellRequestIdRef = useRef(0)

  const handleSearchChange = useCallback((query: string) => {
    setInfiniteScrollError(null)
    setIsLoadingMore(false)
    setRetryCount(0)
    setSearchQuery(query)
  }, [])

  const handleSortChange = useCallback((value: SortOption) => {
    setSortBy(value)
    setSortDirection(getDefaultSortDirection(value))
  }, [])

  const handleHeaderSortToggle = useCallback((value: SortOption) => {
    setSortBy((currentSort) => {
      if (currentSort === value) {
        setSortDirection(currentDirection => (currentDirection === 'asc' ? 'desc' : 'asc'))
        return currentSort
      }

      setSortDirection(getDefaultSortDirection(value))
      return value
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      setInfiniteScrollError(null)
      setIsLoadingMore(false)
      setSearchQuery('')
      setRetryCount(0)
      setHideMergeButton(false)
      setHiddenMergeSignature(null)
    })
  }, [userAddress])

  const {
    status,
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = usePublicPositionsQuery({
    userAddress,
    status: marketStatusFilter,
    minAmountFilter,
    sortBy,
    sortDirection,
    searchQuery: debouncedSearchQuery,
  })

  const positions = useMemo(
    () => data?.pages.flat() ?? [],
    [data?.pages],
  )

  const positionsWithIcons = useMemo(() => {
    if (positions.length === 0) {
      return positions
    }

    const iconByCondition = new Map<string, string>()
    positions.forEach((position) => {
      if (position.conditionId && position.icon) {
        iconByCondition.set(position.conditionId, position.icon)
      }
    })

    if (iconByCondition.size === 0) {
      return positions
    }

    let hasFallbacks = false
    const updatedPositions = positions.map((position) => {
      if (position.icon || !position.conditionId) {
        return position
      }

      const fallbackIcon = iconByCondition.get(position.conditionId)
      if (!fallbackIcon) {
        return position
      }

      hasFallbacks = true
      return { ...position, icon: fallbackIcon }
    })

    return hasFallbacks ? updatedPositions : positions
  }, [positions])

  const visiblePositions = useMemo(
    () => positionsWithIcons.filter(position => matchesPositionsSearchQuery(position, debouncedSearchQuery)),
    [debouncedSearchQuery, positionsWithIcons],
  )

  const sortedPositions = useMemo(
    () => sortPositions(visiblePositions, sortBy, sortDirection),
    [sortBy, sortDirection, visiblePositions],
  )

  const hasUserAddress = Boolean(userAddress)
  const loading = hasUserAddress && status === 'pending'
  const hasInitialError = hasUserAddress && status === 'error'

  const isSearchActive = debouncedSearchQuery.trim().length > 0
  const mergeableMarkets = useMemo(
    () => buildMergeableMarkets(positionsWithIcons),
    [positionsWithIcons],
  )
  const positionsByCondition = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}

    positionsWithIcons
      .filter(position => position.status === 'active' && position.conditionId)
      .forEach((position) => {
        const conditionId = position.conditionId as string
        const assetKey = typeof position.asset === 'string' ? position.asset.trim() : ''
        if (!assetKey) {
          return
        }
        const size = typeof position.size === 'number' ? position.size : 0
        if (!map[conditionId]) {
          map[conditionId] = {}
        }
        map[conditionId][assetKey] = (map[conditionId][assetKey] ?? 0) + size
      })

    return map
  }, [positionsWithIcons])

  const mergeSignature = useMemo(() => {
    if (!availableMergeableMarkets.length) {
      return ''
    }
    return availableMergeableMarkets
      .map(market => `${market.conditionId}:${market.mergeAmount.toFixed(6)}`)
      .sort()
      .join('|')
  }, [availableMergeableMarkets])

  useEffect(() => {
    let cancelled = false

    if (!canSell || mergeableMarkets.length === 0) {
      setAvailableMergeableMarkets([])
      return () => {
        cancelled = true
      }
    }

    fetchLockedSharesByCondition(mergeableMarkets)
      .then((lockedSharesByCondition) => {
        if (cancelled) {
          return
        }

        const eligible = mergeableMarkets
          .map((market) => {
            const conditionId = market.conditionId
            if (!conditionId || !Array.isArray(market.outcomeAssets) || market.outcomeAssets.length !== 2) {
              return null
            }

            const positionShares = positionsByCondition[conditionId]
            if (!positionShares) {
              return null
            }

            const [firstOutcome, secondOutcome] = market.outcomeAssets
            const locked = lockedSharesByCondition[conditionId] ?? {}
            const availableFirst = Math.max(
              0,
              (positionShares[firstOutcome] ?? 0) - (locked[firstOutcome] ?? 0),
            )
            const availableSecond = Math.max(
              0,
              (positionShares[secondOutcome] ?? 0) - (locked[secondOutcome] ?? 0),
            )
            const safeMergeAmount = Math.min(market.mergeAmount, availableFirst, availableSecond)

            if (!Number.isFinite(safeMergeAmount) || safeMergeAmount <= 0) {
              return null
            }

            return {
              ...market,
              mergeAmount: safeMergeAmount,
            }
          })
          .filter((entry): entry is MergeableMarket => Boolean(entry))

        setAvailableMergeableMarkets(eligible)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        console.error('Failed to check merge availability.', error)
        setAvailableMergeableMarkets([])
      })

    return () => {
      cancelled = true
    }
  }, [canSell, mergeableMarkets, positionsByCondition])

  const hasMergeableMarkets = availableMergeableMarkets.length > 0

  const { isMergeProcessing, mergeBatchCount, handleMergeAll } = useMergePositionsAction({
    mergeableMarkets: availableMergeableMarkets,
    positionsByCondition,
    hasMergeableMarkets,
    user,
    ensureTradingReady,
    queryClient,
    signMessageAsync,
    onSuccess: () => setMergeSuccess(true),
  })

  useEffect(() => {
    if (!hideMergeButton || !hiddenMergeSignature) {
      return
    }

    if (mergeSignature && mergeSignature !== hiddenMergeSignature) {
      setHideMergeButton(false)
      setHiddenMergeSignature(null)
    }
  }, [hideMergeButton, hiddenMergeSignature, mergeSignature])

  const handleMergeDialogChange = useCallback((open: boolean) => {
    setIsMergeDialogOpen(open)
    if (!open) {
      if (mergeSuccess) {
        setHideMergeButton(true)
        setHiddenMergeSignature(mergeSignature)
      }
      setMergeSuccess(false)
    }
  }, [mergeSignature, mergeSuccess])

  const shareCardPayload = useMemo(() => {
    if (!sharePosition) {
      return null
    }

    return buildShareCardPayload(sharePosition, {
      userName: user?.username || undefined,
      userImage: user?.image || undefined,
    })
  }, [sharePosition, user?.image, user?.username])

  const handleShareOpenChange = useCallback((open: boolean) => {
    setIsShareDialogOpen(open)
    if (!open) {
      setSharePosition(null)
    }
  }, [])

  const handleShareClick = useCallback((position: PublicPosition) => {
    setSharePosition(position)
    setIsShareDialogOpen(true)
  }, [])

  const resolveOutcomeIndex = useCallback((position: PublicPosition) => {
    if (typeof position.outcomeIndex === 'number') {
      return position.outcomeIndex
    }

    return getOutcomeLabel(position).toLowerCase().includes('no')
      ? OUTCOME_INDEX.NO
      : OUTCOME_INDEX.YES
  }, [])

  const handleSellClick = useCallback(async (position: PublicPosition) => {
    const shares = typeof position.size === 'number' ? position.size : 0
    if (!shares) {
      return
    }

    const requestId = sellRequestIdRef.current + 1
    sellRequestIdRef.current = requestId
    const resolvedOutcomeIndex = resolveOutcomeIndex(position)

    setSellModalPayload({
      position,
      shares,
      filledShares: null,
      avgPriceCents: null,
      limitPriceCents: null,
      receiveAmount: null,
      tokenId: position.asset ?? null,
      isNegRisk: false,
    })

    const eventSlug = position.eventSlug || position.slug
    let tokenId = position.asset ?? null
    let isNegRisk = false

    if (eventSlug && position.conditionId) {
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(eventSlug)}/market-metadata?conditionId=${encodeURIComponent(position.conditionId)}`,
        )
        if (response.ok) {
          const payload = await response.json()
          const outcomes = payload?.data?.outcomes ?? []
          isNegRisk = Boolean(payload?.data?.event_enable_neg_risk || payload?.data?.neg_risk)
          const matchedOutcome = outcomes.find((outcome: { outcome_index?: number }) =>
            outcome.outcome_index === resolvedOutcomeIndex,
          )
          tokenId = matchedOutcome?.token_id ?? tokenId
          setSellModalPayload((current) => {
            if (!current || current.position.id !== position.id || sellRequestIdRef.current !== requestId) {
              return current
            }
            return {
              ...current,
              tokenId,
              isNegRisk,
            }
          })
        }
      }
      catch (error) {
        console.error('Failed to resolve token id for sell preview.', error)
      }
    }

    if (!tokenId) {
      if (sellRequestIdRef.current === requestId) {
        setSellModalPayload(null)
        handleOrderErrorFeedback('Sell unavailable', 'Market data is unavailable.')
      }
      return
    }

    try {
      const summary = await fetchOrderBookSummary(tokenId)
      if (sellRequestIdRef.current !== requestId) {
        return
      }

      const bids = normalizeBookLevels(summary?.bids, 'bid')
      const asks = normalizeBookLevels(summary?.asks, 'ask')
      const fill = calculateMarketFill(ORDER_SIDE.SELL, shares, bids, asks)

      setSellModalPayload((current) => {
        if (!current || current.position.id !== position.id || sellRequestIdRef.current !== requestId) {
          return current
        }
        return {
          ...current,
          filledShares: fill.filledShares,
          avgPriceCents: fill.avgPriceCents,
          limitPriceCents: fill.limitPriceCents ?? null,
          receiveAmount: fill.totalCost > 0 ? fill.totalCost : null,
        }
      })
    }
    catch (error) {
      console.error('Failed to load order book for sell preview.', error)
      if (sellRequestIdRef.current === requestId) {
        handleOrderErrorFeedback('Order book unavailable', 'Please try again in a moment.')
      }
    }
  }, [resolveOutcomeIndex])

  const handleSellModalChange = useCallback((open: boolean) => {
    if (!open) {
      setSellModalPayload(null)
    }
  }, [])

  const handleEditOrder = useCallback(() => {
    if (!sellModalPayload) {
      return
    }

    const { position, shares } = sellModalPayload
    const eventSlug = position.eventSlug || position.slug
    if (!eventSlug) {
      setSellModalPayload(null)
      return
    }

    const resolvedOutcomeIndex = resolveOutcomeIndex(position)

    const params = new URLSearchParams()
    params.set('side', 'SELL')
    params.set('orderType', 'Market')
    params.set('outcomeIndex', resolvedOutcomeIndex.toString())
    params.set('shares', formatAmountInputValue(shares, { roundingMode: 'floor' }))
    if (position.conditionId) {
      params.set('conditionId', position.conditionId)
    }

    setSellModalPayload(null)
    router.push(`/event/${eventSlug}?${params.toString()}`)
  }, [resolveOutcomeIndex, router, sellModalPayload])

  const handleCashOut = useCallback(async () => {
    if (!sellModalPayload || isCashOutSubmitting) {
      return
    }

    const {
      position,
      shares,
      tokenId,
      isNegRisk,
      limitPriceCents,
      avgPriceCents,
      receiveAmount,
      filledShares,
    } = sellModalPayload
    const eventSlug = position.eventSlug || position.slug
    const marketPriceCents = typeof limitPriceCents === 'number' && Number.isFinite(limitPriceCents)
      ? limitPriceCents
      : (typeof avgPriceCents === 'number' && Number.isFinite(avgPriceCents) ? avgPriceCents : null)

    if (!marketPriceCents || (filledShares ?? 0) <= 0) {
      if (eventSlug) {
        handleEditOrder()
        return
      }
      handleOrderErrorFeedback('Trade failed', 'No liquidity for this market order.')
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    if (!isConnected) {
      handleValidationError('NOT_CONNECTED', { openWalletModal: open })
      return
    }

    if (!user) {
      handleValidationError('MISSING_USER', { openWalletModal: open })
      return
    }

    if (!userAddressNormalized || !makerAddress) {
      handleOrderErrorFeedback('Trade failed', 'Wallet not ready for trading.')
      return
    }

    const conditionId = position.conditionId ?? null
    if (!tokenId || !conditionId || !eventSlug) {
      handleOrderErrorFeedback('Trade failed', 'Market data is unavailable.')
      return
    }

    const effectiveShares = formatAmountInputValue(shares, { roundingMode: 'floor' })
    if (!effectiveShares) {
      handleOrderErrorFeedback('Trade failed', 'Invalid share amount.')
      return
    }

    const outcomeIndex = resolveOutcomeIndex(position)
    const outcomeText = getOutcomeLabel(position)
    const timestamp = new Date().toISOString()

    const outcomePayload = {
      id: `portfolio-${tokenId}`,
      condition_id: conditionId,
      outcome_text: outcomeText,
      outcome_index: outcomeIndex,
      token_id: tokenId,
      is_winning_outcome: false,
      created_at: timestamp,
      updated_at: timestamp,
    }

    const orderDomain = getExchangeEip712Domain(isNegRisk)
    const payload = buildOrderPayload({
      userAddress: userAddressNormalized,
      makerAddress,
      signatureType,
      outcome: outcomePayload,
      side: ORDER_SIDE.SELL,
      orderType: ORDER_TYPE.MARKET,
      amount: effectiveShares,
      limitPrice: '0',
      limitShares: '0',
      marketPriceCents,
      feeRateBps: affiliateMetadata.tradeFeeBps,
    })

    let signature: string
    try {
      signature = await signOrderPayload({
        payload,
        domain: orderDomain,
        signTypedDataAsync,
        openAppKit: open,
        closeAppKit: close,
        embeddedWalletInfo,
        onWalletApprovalPrompt: notifyWalletApprovalPrompt,
      })
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        handleOrderCancelledFeedback()
        return
      }
      handleOrderErrorFeedback('Trade failed', 'We could not sign your order. Please try again.')
      return
    }

    setIsCashOutSubmitting(true)
    try {
      const result = await submitOrder({
        order: payload,
        signature,
        orderType: ORDER_TYPE.MARKET,
        conditionId,
        slug: eventSlug,
      })

      if (result?.error) {
        if (isTradingAuthRequiredError(result.error)) {
          openTradeRequirements()
          handleOrderErrorFeedback('Trade failed', 'Complete trading setup to continue.')
        }
        else {
          handleOrderErrorFeedback('Trade failed', result.error)
        }
        return
      }

      const avgSellPriceLabel = formatCentsLabel(marketPriceCents / 100, { fallback: '—' })
      handleOrderSuccessFeedback({
        side: ORDER_SIDE.SELL,
        amountInput: effectiveShares,
        sellSharesLabel: effectiveShares,
        isLimitOrder: false,
        outcomeText,
        eventTitle: position.title,
        marketImage: position.icon ? `https://gateway.irys.xyz/${position.icon}` : undefined,
        marketTitle: position.title,
        sellAmountValue: receiveAmount ?? 0,
        avgSellPrice: avgSellPriceLabel,
        queryClient,
        outcomeIndex,
        lastMouseEvent: null,
      })

      void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })
      setSellModalPayload(null)
    }
    catch {
      handleOrderErrorFeedback('Trade failed', 'An unexpected error occurred. Please try again.')
    }
    finally {
      setIsCashOutSubmitting(false)
    }
  }, [
    affiliateMetadata.tradeFeeBps,
    close,
    embeddedWalletInfo,
    ensureTradingReady,
    handleEditOrder,
    openTradeRequirements,
    isCashOutSubmitting,
    isConnected,
    makerAddress,
    open,
    queryClient,
    resolveOutcomeIndex,
    sellModalPayload,
    signatureType,
    signTypedDataAsync,
    user,
    userAddressNormalized,
  ])

  useEffect(() => {
    setInfiniteScrollError(null)
    setIsLoadingMore(false)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [debouncedSearchQuery, minAmountFilter, marketStatusFilter, sortBy, sortDirection])

  useEffect(() => {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage && !isLoadingMore && !infiniteScrollError) {
        setIsLoadingMore(true)
        fetchNextPage()
          .then(() => {
            setIsLoadingMore(false)
            setRetryCount(0)
          })
          .catch((error) => {
            setIsLoadingMore(false)
            if (error.name !== 'AbortError') {
              setInfiniteScrollError(error.message || 'Failed to load more positions')
            }
          })
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage, isLoadingMore])

  const retryInitialLoad = useCallback(() => {
    const currentRetryCount = retryCount + 1
    setRetryCount(currentRetryCount)
    setInfiniteScrollError(null)
    setIsLoadingMore(false)

    const delay = Math.min(1000 * 2 ** (currentRetryCount - 1), 8000)

    setTimeout(() => {
      void refetch()
    }, delay)
  }, [refetch, retryCount])

  const totals = useMemo(
    () => calculatePositionsTotals(visiblePositions),
    [visiblePositions],
  )

  return (
    <div className="space-y-3 pb-0">
      <PublicPositionsFilters
        searchQuery={searchQuery}
        sortBy={sortBy}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        showMergeButton={hasMergeableMarkets && marketStatusFilter === 'active' && !hideMergeButton}
        onMergeClick={() => {
          setMergeSuccess(false)
          setIsMergeDialogOpen(true)
        }}
      />

      <PublicPositionsTable
        positions={sortedPositions}
        totals={totals}
        isLoading={loading}
        hasInitialError={hasInitialError}
        isSearchActive={isSearchActive}
        searchQuery={debouncedSearchQuery}
        retryCount={retryCount}
        marketStatusFilter={marketStatusFilter}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortHeaderClick={handleHeaderSortToggle}
        onRetry={retryInitialLoad}
        onRefreshPage={() => window.location.reload()}
        onShareClick={handleShareClick}
        onSellClick={canSell ? handleSellClick : undefined}
        loadMoreRef={loadMoreRef}
      />

      {(isFetchingNextPage || isLoadingMore) && (
        <div className="py-4 text-center text-xs text-muted-foreground">Loading more...</div>
      )}

      {infiniteScrollError && (
        <div className="py-4 text-center text-xs text-no">
          {infiniteScrollError}
          {' '}
          <button type="button" onClick={retryInitialLoad} className="underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      <MergePositionsDialog
        open={isMergeDialogOpen}
        onOpenChange={handleMergeDialogChange}
        markets={availableMergeableMarkets}
        isProcessing={isMergeProcessing}
        mergeCount={mergeBatchCount}
        isSuccess={mergeSuccess}
        onConfirm={handleMergeAll}
      />

      <PositionShareDialog
        open={isShareDialogOpen}
        onOpenChange={handleShareOpenChange}
        payload={shareCardPayload}
      />

      {sellModalPayload && (
        <SellPositionModal
          open={Boolean(sellModalPayload)}
          onOpenChange={handleSellModalChange}
          outcomeLabel={getOutcomeLabel(sellModalPayload.position)}
          outcomeShortLabel={sellModalPayload.position.title}
          outcomeIconUrl={sellModalPayload.position.icon
            ? `https://gateway.irys.xyz/${sellModalPayload.position.icon}`
            : undefined}
          shares={sellModalPayload.shares}
          filledShares={sellModalPayload.filledShares}
          avgPriceCents={sellModalPayload.avgPriceCents}
          receiveAmount={sellModalPayload.receiveAmount}
          onCashOut={handleCashOut}
          onEditOrder={handleEditOrder}
        />
      )}
    </div>
  )
}
