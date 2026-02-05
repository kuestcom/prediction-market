'use client'

import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, Clock3Icon, PlusIcon, SparkleIcon, TrophyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/formatters'
import { isMarketNew } from '@/lib/utils'

interface EventMetaInformationProps {
  event: Event
}

export default function EventMetaInformation({ event }: EventMetaInformationProps) {
  const t = useExtracted()

  const volumeRequestPayload = useMemo(() => {
    const conditions = event.markets
      .map((market) => {
        const tokenIds = (market.outcomes ?? [])
          .map(outcome => outcome.token_id)
          .filter(Boolean)
          .slice(0, 2)
        if (!market.condition_id || tokenIds.length < 2) {
          return null
        }
        return {
          condition_id: market.condition_id,
          token_ids: tokenIds as [string, string],
        }
      })
      .filter((item): item is { condition_id: string, token_ids: [string, string] } => item !== null)

    const signature = conditions
      .map(condition => `${condition.condition_id}:${condition.token_ids.join(':')}`)
      .join('|')

    return { conditions, signature }
  }, [event.markets])

  const { data: volumeFromApi } = useQuery({
    queryKey: ['trade-volumes', event.id, volumeRequestPayload.signature],
    enabled: volumeRequestPayload.conditions.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(`${process.env.CLOB_URL}/data/volumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          include_24h: false,
          conditions: volumeRequestPayload.conditions,
        }),
      })

      const payload = await response.json() as Array<{
        condition_id: string
        status: number
        volume?: string
      }>

      return payload
        .filter(entry => entry?.status === 200)
        .reduce((total, entry) => {
          const numeric = Number(entry.volume ?? 0)
          return Number.isFinite(numeric) ? total + numeric : total
        }, 0)
    },
  })

  const resolvedVolume = useMemo(() => {
    if (typeof volumeFromApi === 'number' && Number.isFinite(volumeFromApi)) {
      return volumeFromApi
    }
    return event.volume
  }, [event.volume, volumeFromApi])

  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  const isNegRiskAugmented = Boolean(event.neg_risk_augmented)
  const shouldShowNew = event.markets.some(
    market => isMarketNew(market.created_at),
  )
  const shouldShowVolume = !shouldShowNew
  const shouldShowMetaBlock = isNegRiskEnabled || shouldShowVolume
  const expiryTooltip = t.rich(
    'This is estimated end date.<br></br>See rules below for specific resolution details.',
    { br: () => ' ' },
  )
  const formattedVolume = Number.isFinite(resolvedVolume)
    ? (resolvedVolume || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
  const volumeLabel = t('{amount} Vol.', { amount: `$${formattedVolume}` })

  const maybeEndDate = event.end_date ? new Date(event.end_date) : null
  const expiryDate = maybeEndDate && !Number.isNaN(maybeEndDate.getTime()) ? maybeEndDate : null
  const remainingDays = expiryDate
    ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null
  const remainingLabel = remainingDays !== null ? t('In {days} days', { days: String(remainingDays) }) : ''
  const shouldShowDividerAfterNew = shouldShowNew && (shouldShowMetaBlock || Boolean(expiryDate))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shouldShowNew && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <SparkleIcon className="size-3.5 fill-current" stroke="currentColor" fill="currentColor" />
          <span>{t('New')}</span>
        </span>
      )}
      {shouldShowDividerAfterNew && (
        <span className="mx-1.5 h-4 w-px bg-muted-foreground/40" aria-hidden="true" />
      )}
      {shouldShowMetaBlock && (
        <div className="flex items-center gap-2">
          {isNegRiskEnabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t('Negative risk details')}
                  className="inline-flex items-center justify-center transition-colors"
                >
                  <TrophyIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                collisionPadding={16}
                className="max-w-68 p-3 text-left text-sm"
              >
                <div className="flex flex-col gap-3">
                  <span className="text-base font-bold">{t('Winner-take-all')}</span>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                      <span className="font-normal">{t('Only 1 winner')}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                      <span className="font-normal">
                        {t('Supports negative risk (convert {no} shares to {yes} of the other options)', {
                          no: t('No'),
                          yes: t('Yes'),
                        })}
                      </span>
                    </div>
                    {isNegRiskAugmented && (
                      <div className="flex items-start gap-3">
                        <PlusIcon className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span className="font-normal">
                          <span className="font-bold">{t('Complete negative risk')}</span>
                          {' '}
                          {t('Users who convert will receive {yes} shares in any outcomes added in the future', {
                            yes: t('Yes'),
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {shouldShowVolume && <span className="text-sm font-medium">{volumeLabel}</span>}
        </div>
      )}
      {shouldShowMetaBlock && expiryDate && (
        <span className="mx-1.5 h-4 w-px bg-muted-foreground/40" aria-hidden="true" />
      )}
      {expiryDate && (
        <Tooltip>
          <TooltipTrigger>
            <span className="flex items-center gap-1.5 text-sm/tight text-muted-foreground">
              <Clock3Icon className="size-4 text-muted-foreground" strokeWidth={2.5} />
              <span>{formatDate(expiryDate)}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            collisionPadding={16}
            className="max-w-64 text-left"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{remainingLabel}</span>
              <span className="text-xs text-foreground">{expiryTooltip}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
