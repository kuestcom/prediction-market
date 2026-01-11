'use client'

import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { AlertCircleIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import ProfileLink from '@/components/ProfileLink'
import ProfileLinkSkeleton from '@/components/ProfileLinkSkeleton'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchTopHolders } from '@/lib/data-api/holders'
import { sharesFormatter } from '@/lib/formatters'
import { useIsSingleMarket, useOrder } from '@/stores/useOrder'

interface EventTopHoldersProps {
  event: Event
}

function useEventHolders(conditionId?: string, yesToken?: string, noToken?: string) {
  return useQuery({
    queryKey: ['event-holders', conditionId, yesToken, noToken],
    queryFn: () => fetchTopHolders(conditionId!, 50, { yesToken, noToken }),
    enabled: Boolean(conditionId),
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    retry: 3,
  })
}

function formatHolderShares(value: string | number | null | undefined) {
  const numericValue = typeof value === 'string'
    ? Number.parseFloat(value)
    : Number(value ?? 0)

  if (!Number.isFinite(numericValue)) {
    return '0'
  }

  return sharesFormatter.format(Number(numericValue.toFixed(2)))
}

export default function EventTopHolders({ event }: EventTopHoldersProps) {
  const isSingleMarket = useIsSingleMarket()
  const orderState = useOrder()
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const fallbackConditionId = event.markets[0]?.condition_id

  useEffect(() => {
    if (isSingleMarket) {
      queueMicrotask(() => setSelectedMarket(''))
    }
    else if (orderState.market && !selectedMarket) {
      queueMicrotask(() => setSelectedMarket(orderState.market!.condition_id))
    }
    else if (!selectedMarket && event.markets.length > 0) {
      queueMicrotask(() => setSelectedMarket(event.markets[0].condition_id))
    }
  }, [isSingleMarket, orderState.market, selectedMarket, event.markets])

  useEffect(() => {
    if (!isSingleMarket && orderState.market && selectedMarket !== orderState.market.condition_id) {
      queueMicrotask(() => setSelectedMarket(orderState.market!.condition_id))
    }
  }, [isSingleMarket, orderState.market, selectedMarket])

  const conditionId = selectedMarket || fallbackConditionId
  const marketForTokens = event.markets.find(m => m.condition_id === conditionId)
  const yesToken = marketForTokens?.outcomes?.find(o => o.outcome_index === 0)?.token_id
  const noToken = marketForTokens?.outcomes?.find(o => o.outcome_index === 1)?.token_id

  const { data, isLoading, error } = useEventHolders(conditionId, yesToken, noToken)

  function handleMarketChange(conditionId: string) {
    setSelectedMarket(conditionId)

    const market = event.markets.find(m => m.condition_id === conditionId)
    if (market) {
      orderState.setMarket(market)
      if (market.outcomes.length > 0) {
        orderState.setOutcome(market.outcomes[0])
      }
    }
  }

  if (!conditionId) {
    return (
      <div className="mt-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>No market available for this event</AlertTitle>
        </Alert>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mt-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="grid min-w-0 grid-cols-2 gap-6">
          <div>
            <div className="mt-1 min-w-0 divide-y divide-border border-t">
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
            </div>
          </div>
          <div>
            <div className="mt-1 min-w-0 divide-y divide-border border-t">
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
              <ProfileLinkSkeleton
                showChildren={false}
                showTrailing={true}
                usernameMinWidthClassName="min-w-0"
                usernameMaxWidthClassName="max-w-35"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Failed to load holders</AlertTitle>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {!isSingleMarket && event.markets.length > 1 && (
        <div className="mb-4">
          <Select value={selectedMarket} onValueChange={handleMarketChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select market..." />
            </SelectTrigger>
            <SelectContent>
              {event.markets.map(market => (
                <SelectItem key={market.condition_id} value={market.condition_id}>
                  {market.short_title || market.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Yes holders</span>
            <span className="text-2xs leading-none font-semibold tracking-wide text-muted-foreground">
              SHARES
            </span>
          </div>
          <div className="mt-1 divide-y divide-border border-t">
            {!data?.yesHolders || data.yesHolders.length === 0
              ? <p className="py-2 text-sm text-muted-foreground">No holders found</p>
              : (
                  data.yesHolders.map(holder => (
                    <ProfileLink
                      key={holder.user.proxy_wallet_address!}
                      user={holder.user}
                      tooltipVariant="activity"
                      joinedAt={holder.user.created_at}
                      usernameClassName="font-semibold text-foreground"
                      usernameMaxWidthClassName="max-w-35"
                      trailing={(
                        <span className="text-sm font-semibold text-yes tabular-nums">
                          {formatHolderShares(holder.net_position)}
                        </span>
                      )}
                    />
                  ))
                )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">No holders</span>
            <span className="text-2xs leading-none font-semibold tracking-wide text-muted-foreground">
              SHARES
            </span>
          </div>
          <div className="mt-1 divide-y divide-border border-t">
            {!data?.noHolders || data.noHolders.length === 0
              ? <p className="py-2 text-sm text-muted-foreground">No holders found</p>
              : (
                  data.noHolders.map(holder => (
                    <ProfileLink
                      key={holder.user.proxy_wallet_address!}
                      user={holder.user}
                      tooltipVariant="activity"
                      joinedAt={holder.user.created_at}
                      usernameClassName="font-semibold text-foreground"
                      usernameMaxWidthClassName="max-w-35"
                      trailing={(
                        <span className="text-sm font-semibold text-no tabular-nums">
                          {formatHolderShares(holder.net_position)}
                        </span>
                      )}
                    />
                  ))
                )}
          </div>
        </div>
      </div>
    </div>
  )
}
