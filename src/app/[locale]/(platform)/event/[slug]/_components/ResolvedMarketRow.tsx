'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { CheckIcon, XIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import EventMarketRowShell from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketRowShell'
import { resolveWinningOutcomeIndex } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventMarketUtils'
import EventIconImage from '@/components/EventIconImage'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn } from '@/lib/utils'

export default function ResolvedMarketRow({
  row,
  showMarketIcon,
  isExpanded,
  resolvedOutcomeIndexOverride = null,
  onToggle,
}: {
  row: EventMarketRow
  showMarketIcon: boolean
  isExpanded: boolean
  resolvedOutcomeIndexOverride?: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | null
  onToggle: () => void
}) {
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { market } = row
  const resolvedOutcomeIndex = resolvedOutcomeIndexOverride ?? resolveWinningOutcomeIndex(market)
  const hasResolvedOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES || resolvedOutcomeIndex === OUTCOME_INDEX.NO
  const isYesOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES
  const resolvedOutcomeText = market.outcomes.find(
    outcome => outcome.outcome_index === resolvedOutcomeIndex,
  )?.outcome_text
  const resolvedOutcomeLabel = (resolvedOutcomeText ? normalizeOutcomeLabel(resolvedOutcomeText) : '')
    || resolvedOutcomeText
    || (isYesOutcome ? t('Yes') : t('No'))
  const resolvedVolume = Number.isFinite(market.volume) ? market.volume : 0
  const shouldShowIcon = showMarketIcon && Boolean(market.icon_url)

  return (
    <EventMarketRowShell isExpanded={isExpanded} onToggle={onToggle}>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-full items-start gap-3 lg:w-2/5">
          {shouldShowIcon && (
            <EventIconImage
              src={market.icon_url}
              alt={market.title}
              sizes="42px"
              containerClassName="size-[42px] shrink-0 rounded-md"
            />
          )}
          <div>
            <div className="text-sm font-bold underline-offset-2 group-hover:underline">
              {market.short_title || market.title}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('{amount} Vol.', {
                amount: `$${resolvedVolume.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full justify-end lg:ms-auto lg:w-auto">
          {hasResolvedOutcome
            ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="text-base font-bold">{resolvedOutcomeLabel}</span>
                  <span className={cn(
                    'flex size-4 items-center justify-center rounded-full',
                    isYesOutcome ? 'bg-yes' : 'bg-no',
                  )}
                  >
                    {isYesOutcome
                      ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                      : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                  </span>
                </span>
              )
            : (
                <span className="text-sm font-semibold text-muted-foreground">{t('Resolved')}</span>
              )}
        </div>
      </div>
    </EventMarketRowShell>
  )
}
