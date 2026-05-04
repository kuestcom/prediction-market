'use client'

import type { SportsGamesMarketType } from './sports-games-center-types'
import type { SportsGamesButton, SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { Outcome } from '@/types'
import { EqualIcon } from 'lucide-react'
import Image from 'next/image'
import { shouldUseCroppedSportsTeamLogo } from '@/lib/sports-team-logo'
import { cn } from '@/lib/utils'
import {
  normalizeComparableText,
  resolveLeadingSpreadTeam,
  resolveSelectedMarket,
  resolveSelectedTradeLabel,
  resolveTeamByTone,
  resolveTradeHeaderBadgeAccent,
  resolveTradeHeaderTitle,
} from './sports-games-center-utils'

function TeamLogoBadge({
  card,
  button,
}: {
  card: SportsGamesCard
  button: SportsGamesButton
}) {
  const useCroppedTeamLogo = shouldUseCroppedSportsTeamLogo(card.event.sports_sport_slug)
  const team = button.marketType === 'spread'
    ? resolveLeadingSpreadTeam(card, button)
    : resolveTeamByTone(card, button.tone)
  const fallbackInitial = team?.abbreviation?.slice(0, 1).toUpperCase()
    || team?.name?.slice(0, 1).toUpperCase()
    || '?'

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        useCroppedTeamLogo ? 'relative size-11 overflow-hidden rounded-lg' : 'size-11',
      )}
    >
      {team?.logoUrl
        ? (
            useCroppedTeamLogo
              ? (
                  <Image
                    src={team.logoUrl}
                    alt={`${team.name} logo`}
                    fill
                    sizes="44px"
                    className="scale-[1.12] object-cover object-center"
                  />
                )
              : (
                  <Image
                    src={team.logoUrl}
                    alt={`${team.name} logo`}
                    width={44}
                    height={44}
                    sizes="44px"
                    className="size-[92%] object-contain object-center"
                  />
                )
          )
        : (
            <div
              className={cn(
                'flex size-full items-center justify-center text-sm font-semibold text-muted-foreground',
                useCroppedTeamLogo && 'rounded-lg border border-border/40 bg-secondary',
              )}
            >
              {fallbackInitial}
            </div>
          )}
    </div>
  )
}

function DrawBadge() {
  return (
    <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground shadow-sm">
      <EqualIcon className="size-5.5" />
    </div>
  )
}

function TotalBadge({ button }: { button: SportsGamesButton }) {
  const isOverActive = button.tone === 'over'
  const isUnderActive = button.tone === 'under'

  return (
    <div
      className={`
        relative inline-flex size-11 items-center justify-center overflow-hidden rounded-lg text-white shadow-sm
      `}
    >
      <span
        className={cn(
          'absolute inset-0 bg-yes transition-opacity [clip-path:polygon(0_0,100%_0,0_100%)]',
          !isOverActive && 'opacity-25',
        )}
      />
      <span
        className={cn(
          'absolute inset-0 bg-no transition-opacity [clip-path:polygon(100%_0,100%_100%,0_100%)]',
          !isUnderActive && 'opacity-25',
        )}
      />
      <span className={cn(
        'absolute top-2 left-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isOverActive && 'opacity-35',
      )}
      >
        O
      </span>
      <span className={cn(
        'absolute right-2 bottom-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isUnderActive && 'opacity-35',
      )}
      >
        U
      </span>
    </div>
  )
}

function BttsBadge({ button }: { button: SportsGamesButton }) {
  const isYesActive = button.tone !== 'under'
  const isNoActive = button.tone === 'under'

  return (
    <div
      className={`
        relative inline-flex size-11 items-center justify-center overflow-hidden rounded-lg text-white shadow-sm
      `}
    >
      <span
        className={cn(
          'absolute inset-0 bg-yes transition-opacity [clip-path:polygon(0_0,100%_0,0_100%)]',
          !isYesActive && 'opacity-25',
        )}
      />
      <span
        className={cn(
          'absolute inset-0 bg-no transition-opacity [clip-path:polygon(100%_0,100%_100%,0_100%)]',
          !isNoActive && 'opacity-25',
        )}
      />
      <span className={cn(
        'absolute top-2 left-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isYesActive && 'opacity-35',
      )}
      >
        Y
      </span>
      <span className={cn(
        'absolute right-2 bottom-2 z-10 text-[11px] leading-none font-bold tracking-wide',
        !isNoActive && 'opacity-35',
      )}
      >
        N
      </span>
    </div>
  )
}

export default function SportsOrderPanelMarketInfo({
  card,
  selectedButton,
  selectedOutcome,
  marketType,
}: {
  card: SportsGamesCard
  selectedButton: SportsGamesButton
  selectedOutcome: Outcome | null
  marketType: SportsGamesMarketType
}) {
  const selectedMarket = resolveSelectedMarket(card, selectedButton.key)
  const badgeLabel = resolveSelectedTradeLabel(card, selectedButton, selectedOutcome)
  const headerTitle = resolveTradeHeaderTitle({
    card,
    selectedButton,
    selectedMarket,
    marketType,
  })
  const badgeAccent = resolveTradeHeaderBadgeAccent(selectedButton)
  const isExactScoreTrade = normalizeComparableText(selectedMarket?.sports_market_type).includes('exact score')
  let marketIcon: React.ReactNode = null
  if (!isExactScoreTrade) {
    if (marketType === 'total') {
      marketIcon = <TotalBadge button={selectedButton} />
    }
    else if (marketType === 'btts') {
      marketIcon = <BttsBadge button={selectedButton} />
    }
    else if (selectedButton.tone === 'draw') {
      marketIcon = <DrawBadge />
    }
    else {
      marketIcon = <TeamLogoBadge card={card} button={selectedButton} />
    }
  }

  return (
    <div className="mb-4">
      <div className={cn('flex items-start', marketIcon && 'gap-3')}>
        {marketIcon && (
          <div className="shrink-0">
            {marketIcon}
          </div>
        )}

        <div className="min-w-0">
          <p className="line-clamp-2 text-base/tight font-bold text-foreground">
            {headerTitle}
          </p>
          <span
            className={cn(
              'mt-1.5 inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold',
              badgeAccent.className,
            )}
            style={badgeAccent.style}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
