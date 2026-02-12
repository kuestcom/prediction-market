import type { Event } from '@/types'
import type { SelectedOutcome } from '@/types/EventCardTypes'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { Link } from '@/i18n/navigation'
import { OUTCOME_INDEX } from '@/lib/constants'

function normalizeOutcomeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

interface EventCardHeaderProps {
  event: Event
  activeOutcome?: SelectedOutcome | null
  isInTradingMode: boolean
  isSingleMarket: boolean
  roundedPrimaryDisplayChance: number
  onCancelTrade: () => void
}

export default function EventCardHeader({
  event,
  activeOutcome,
  isInTradingMode,
  isSingleMarket,
  roundedPrimaryDisplayChance,
  onCancelTrade,
}: EventCardHeaderProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const activeMarket = activeOutcome?.market
  const tradingTitle = !isSingleMarket
    ? activeMarket?.short_title || activeMarket?.title
    : null
  const headerTitle = (isInTradingMode && tradingTitle) ? tradingTitle : event.title
  const headerIcon = (isInTradingMode && activeMarket?.icon_url) ? activeMarket.icon_url : event.icon_url
  const iconSizeClass = isInTradingMode ? 'size-7' : 'size-10'
  const isResolvedEvent = event.status === 'resolved'
  const primaryMarket = event.markets[0]
  const yesOutcome = primaryMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? primaryMarket?.outcomes[0]
  const noOutcome = primaryMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO) ?? primaryMarket?.outcomes[1]
  const outcomeLabels = new Set([
    normalizeOutcomeText(yesOutcome?.outcome_text),
    normalizeOutcomeText(noOutcome?.outcome_text),
  ])
  const hasStandardYesNoOutcomes = outcomeLabels.has('yes') && outcomeLabels.has('no')
  const isTiedChance = roundedPrimaryDisplayChance === 50
  const leadingOutcomeLabel = roundedPrimaryDisplayChance > 50
    ? yesOutcome?.outcome_text
    : noOutcome?.outcome_text
  const chanceFooterLabel = !hasStandardYesNoOutcomes && !isTiedChance
    ? (normalizeOutcomeLabel(leadingOutcomeLabel) || t('chance'))
    : t('chance')

  return (
    <div className="mb-3 flex items-start justify-between">
      <Link href={`/event/${event.slug}`} className="flex flex-1 items-center gap-2 pr-2">
        <div
          className={`
            flex ${iconSizeClass}
            shrink-0 items-center justify-center self-start overflow-hidden rounded-sm
          `}
        >
          <Image
            src={headerIcon}
            alt={headerTitle || event.creator || 'Market'}
            width={40}
            height={40}
            className="size-full rounded-sm object-cover"
          />
        </div>

        <h3
          className={
            `
              line-clamp-2 w-full text-sm/5 font-semibold underline-offset-2 transition-colors duration-200
              hover:line-clamp-none hover:text-foreground hover:underline
            `
          }
        >
          {headerTitle}
        </h3>
      </Link>

      {isInTradingMode
        ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCancelTrade()
              }}
              className={
                `
                  flex size-6 items-center justify-center rounded-md text-slate-600 transition-colors
                  hover:bg-slate-200
                  dark:text-slate-400
                  dark:hover:bg-slate-600
                `
              }
            >
              ✕
            </button>
          )
        : (
            isSingleMarket && !isResolvedEvent && (
              <div className="relative -mt-3 flex flex-col items-center">
                <div className="relative">
                  <svg
                    width="72"
                    height="52"
                    viewBox="0 0 72 52"
                    className="rotate-0 transform"
                  >
                    <path
                      d="M 6 46 A 30 30 0 0 1 66 46"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      className="text-slate-200 dark:text-slate-600"
                    />

                    <path
                      d="M 6 46 A 30 30 0 0 1 66 46"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      className={
                        `transition-all duration-300 ${
                          roundedPrimaryDisplayChance < 40
                            ? 'text-no'
                            : roundedPrimaryDisplayChance === 50
                              ? 'text-slate-400'
                              : 'text-yes'
                        }`
                      }
                      strokeDasharray={`${(roundedPrimaryDisplayChance / 100) * 94.25} 94.25`}
                      strokeDashoffset="0"
                    />
                  </svg>

                  <div className="absolute inset-0 flex items-center justify-center pt-4">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {roundedPrimaryDisplayChance}
                      %
                    </span>
                  </div>
                </div>

                <div className="-mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {chanceFooterLabel}
                </div>
              </div>
            )
          )}
    </div>
  )
}
