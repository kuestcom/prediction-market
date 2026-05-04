'use client'

import type { Route } from 'next'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import type { SportsGamesCenterProps, SportsGamesMarketType } from './_sports-games-center/sports-games-center-types'
import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import {
  CheckIcon,
  ChevronRightIcon,
  RadioIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import SportsLivestreamFloatingPlayer
  from '@/app/[locale]/(platform)/sports/_components/SportsLivestreamFloatingPlayer'
import {
  hasSportsGamesCardPrimaryMarketTrio,
  resolveSportsGamesCardVisibleMarketTypes,
  resolveSportsGamesHeaderMarketTypes,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter } from '@/i18n/navigation'
import { formatVolume } from '@/lib/formatters'
import { ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'
import { shouldUseCroppedSportsTeamLogo } from '@/lib/sports-team-logo'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useSportsLivestream } from '@/stores/useSportsLivestream'
import { headerIconButtonClass, MARKET_COLUMN_BY_KEY } from './_sports-games-center/sports-games-center-constants'
import {
  groupButtonsByMarketType,
  isCardLiveNow,
  parseSportsScore,
  resolveActiveMarketType,
  resolveButtonDepthStyle,
  resolveButtonOverlayStyle,
  resolveButtonStyle,
  resolveDefaultConditionId,
  resolveMoneylineButtonGridClass,
  resolveSelectedButton,
} from './_sports-games-center/sports-games-center-utils'
import SportsGameDetailsPanel from './_sports-games-center/SportsGameDetailsPanel'
import SportsOrderPanelMarketInfo from './_sports-games-center/SportsOrderPanelMarketInfo'
import {
  useCardButtonPriceMap,
  useCardGroupings,
  useCategoryResolver,
  useEffectiveOpenAndTradeSelection,
  useLocaleDateTimeFormatters,
  useOddsFormatAndSpreadsTotalsPersistence,
  useResetMobileOrderPanelOnDeviceChange,
  useResolveDisplayButtonKey,
  useSearchAutoFocus,
  useSearchOutsidePointerClose,
  useSportsActiveTradeContext,
  useSportsGamesButtonOddsFormatter,
  useSportsGamesCenterShellState,
  useSportsOrderStoreSync,
  useSportsSearchFilteredCards,
  useVisiblePageCards,
  useWeekFilterState,
} from './_sports-games-center/useSportsGamesCenter'

// Re-export types and values consumed by SportsEventCenter and other external files
export type { SportsGameGraphVariant, SportsGamesMarketType, SportsLinePickerOption } from './_sports-games-center/sports-games-center-types'
export {
  buildLinePickerOptions,
  groupButtonsByMarketType,
  resolveButtonDepthStyle,
  resolveButtonOverlayStyle,
  resolveButtonStyle,
  resolveDefaultConditionId,
  resolveOrderPanelOutcomeAccentOverrides,
  resolveOrderPanelOutcomeLabelOverrides,
  resolvePreferredLinePickerButton,
  resolveSelectedButton,
  resolveSelectedMarket,
  resolveSelectedOutcome,
  resolveStableSpreadPrimaryOutcomeIndex,
} from './_sports-games-center/sports-games-center-utils'
export { default as SportsGameDetailsPanel } from './_sports-games-center/SportsGameDetailsPanel'
export { default as SportsGameGraph } from './_sports-games-center/SportsGameGraph'
export { default as SportsOrderPanelMarketInfo } from './_sports-games-center/SportsOrderPanelMarketInfo'

export default function SportsGamesCenter({
  cards,
  sportSlug,
  sportTitle,
  pageMode = 'games',
  categoryTitleBySlug = {},
  initialWeek = null,
  vertical = 'sports',
  showHeading = true,
}: SportsGamesCenterProps) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const router = useRouter()
  const locale = useLocale()
  const isMobile = useIsMobile()
  const {
    openCardId,
    setOpenCardId,
    isDetailsContentVisible,
    setIsDetailsContentVisible,
    activeDetailsTab,
    setActiveDetailsTab,
    selectedConditionByCardId,
    setSelectedConditionByCardId,
    tradeSelection,
    setTradeSelection,
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    oddsFormat,
    setOddsFormat,
    showSpreadsAndTotals,
    setShowSpreadsAndTotals,
    searchShellRef,
    searchInputRef,
  } = useSportsGamesCenterShellState()
  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const currentTimestampMs = currentTimestamp ?? 0
  const openLivestream = useSportsLivestream(state => state.openStream)
  const setOrderEvent = useOrder(state => state.setEvent)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderSide = useOrder(state => state.setSide)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const orderMarketConditionId = useOrder(state => state.market?.condition_id ?? null)
  const orderOutcomeIndex = useOrder(state => state.outcome?.outcome_index ?? null)
  const isLivePage = pageMode === 'live'
  const isLiveAndSoonPage = pageMode === 'liveAndSoon'
  const isSoonPage = pageMode === 'soon'
  const isFeedPage = isLivePage || isLiveAndSoonPage || isSoonPage
  const { resolveCardCategory } = useCategoryResolver(categoryTitleBySlug)

  useOddsFormatAndSpreadsTotalsPersistence({ oddsFormat, showSpreadsAndTotals })

  useResetMobileOrderPanelOnDeviceChange({ isMobile, setIsMobileOrderPanelOpen })

  const { formatButtonOdds } = useSportsGamesButtonOddsFormatter(oddsFormat)

  const { resolveDisplayButtonKey } = useResolveDisplayButtonKey(showSpreadsAndTotals)

  const { visibleCards, pageCards } = useVisiblePageCards({
    cards,
    isFeedPage,
    isLivePage,
    isSoonPage,
    currentTimestampMs,
  })

  const {
    weekOptions,
    effectiveSelectedWeek,
    setSelectedWeek,
    weekFilteredCards,
  } = useWeekFilterState({ initialWeek, isFeedPage, visibleCards, pageCards })

  useSearchAutoFocus({ isSearchOpen, searchInputRef })

  useSearchOutsidePointerClose({ isSearchOpen, searchQuery, searchShellRef, setIsSearchOpen })

  const { normalizedSearchQuery, filteredCards } = useSportsSearchFilteredCards({
    weekFilteredCards,
    searchQuery,
    resolveCardCategory,
  })
  const { buttonPriceCentsByKey } = useCardButtonPriceMap(filteredCards)

  const emptyStateLabel = normalizedSearchQuery
    ? 'No games found for this search.'
    : isLiveAndSoonPage
      ? 'No live or upcoming games available.'
      : isLivePage
        ? 'No live games available.'
        : isSoonPage
          ? 'No upcoming games available.'
          : 'No games available for this week.'

  const liveSectionEmptyStateLabel = normalizedSearchQuery
    ? 'No live games found for this search.'
    : 'No live games available.'

  const { effectiveOpenCardId, effectiveTradeSelection } = useEffectiveOpenAndTradeSelection({
    openCardId,
    filteredCards,
    tradeSelection,
    selectedConditionByCardId,
    showSpreadsAndTotals,
    resolveDisplayButtonKey,
  })

  const effectiveIsDetailsContentVisible = effectiveOpenCardId
    ? isDetailsContentVisible
    : true

  const { dateLabelFormatter, timeLabelFormatter } = useLocaleDateTimeFormatters(locale)

  const {
    groupedCards,
    liveCardsByCategory,
    startingSoonGroupsByDate,
  } = useCardGroupings({
    filteredCards,
    dateLabelFormatter,
    resolveCardCategory,
    currentTimestampMs,
  })
  const hasFeedResults = isLiveAndSoonPage
    ? liveCardsByCategory.length > 0 || startingSoonGroupsByDate.length > 0
    : isLivePage
      ? liveCardsByCategory.length > 0
      : isSoonPage
        ? startingSoonGroupsByDate.length > 0
        : false

  const {
    activeTradeContext,
    activeTradePrimaryOutcomeIndex,
    activeTradeHeaderContext,
    orderPanelOutcomeLabelOverrides,
    orderPanelOutcomeAccentOverrides,
  } = useSportsActiveTradeContext({
    effectiveOpenCardId,
    effectiveTradeSelection,
    filteredCards,
    resolveDisplayButtonKey,
    selectedConditionByCardId,
    orderMarketConditionId,
    orderOutcomeIndex,
  })

  useSportsOrderStoreSync({
    activeTradeContext,
    setOrderEvent,
    setOrderMarket,
    setOrderOutcome,
    setOrderSide,
  })

  function toggleCard(
    card: SportsGamesCard,
    event?: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
  ) {
    if (event) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-sports-card-control="true"]')) {
        return
      }
    }

    if (card.event.sports_ended === true) {
      const shouldOpen = effectiveOpenCardId !== card.id
      setOpenCardId(shouldOpen ? card.id : null)
      setIsDetailsContentVisible(shouldOpen)
      if (shouldOpen) {
        setActiveDetailsTab('graph')
      }
      return
    }

    const defaultConditionId = resolveDefaultConditionId(card)
    const selectedButtonKey = resolveDisplayButtonKey(
      card,
      selectedConditionByCardId[card.id] ?? defaultConditionId,
    )
    const selectedButton = resolveSelectedButton(card, selectedButtonKey)
    const isSpreadOrTotalSelected = selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'

    setTradeSelection({
      cardId: card.id,
      buttonKey: selectedButton?.key ?? defaultConditionId,
    })

    setSelectedConditionByCardId((current) => {
      if (!defaultConditionId || current[card.id]) {
        return current
      }

      return {
        ...current,
        [card.id]: defaultConditionId,
      }
    })

    if (effectiveOpenCardId !== card.id) {
      setOpenCardId(card.id)
      setIsDetailsContentVisible(true)
      setActiveDetailsTab('orderBook')
      return
    }

    if (effectiveIsDetailsContentVisible) {
      if (isSpreadOrTotalSelected) {
        setIsDetailsContentVisible(false)
        return
      }

      setOpenCardId(null)
      setIsDetailsContentVisible(true)
      return
    }

    setIsDetailsContentVisible(true)
  }

  function selectCardButton(
    card: SportsGamesCard,
    buttonKey: string,
    _options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) {
    const normalizedButtonKey = resolveDisplayButtonKey(card, buttonKey)
    if (!normalizedButtonKey) {
      return
    }

    setSelectedConditionByCardId((current) => {
      if (current[card.id] === normalizedButtonKey) {
        return current
      }

      return {
        ...current,
        [card.id]: normalizedButtonKey,
      }
    })

    setTradeSelection({
      cardId: card.id,
      buttonKey: normalizedButtonKey,
    })

    if (isMobile) {
      setIsMobileOrderPanelOpen(true)
      return
    }

    setOpenCardId(null)
    setIsDetailsContentVisible(false)
  }

  function renderMarketColumnsHeader(headerKeyPrefix: string, cardsInGroup: SportsGamesCard[]) {
    const headerColumns = resolveSportsGamesHeaderMarketTypes(cardsInGroup, showSpreadsAndTotals)
      .map(marketType => MARKET_COLUMN_BY_KEY.get(marketType))
      .filter((column): column is { key: SportsGamesMarketType, label: string } => Boolean(column))
    if (headerColumns.length === 0) {
      return null
    }

    return (
      <div
        className={cn(
          'hidden gap-2 min-[1200px]:mr-2 min-[1200px]:ml-auto min-[1200px]:grid',
          'w-[372px]',
          headerColumns.length === 1 ? 'grid-cols-1' : 'grid-cols-3',
        )}
      >
        {headerColumns.map(column => (
          <div
            key={`${headerKeyPrefix}-${column.key}-header`}
            className="flex w-full items-center justify-center"
          >
            <p className="text-center text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
              {column.label}
            </p>
          </div>
        ))}
      </div>
    )
  }

  function renderCard(
    card: SportsGamesCard,
    options: {
      topBadgeMode: 'time' | 'live'
      categoryLabel: string
    },
  ) {
    const parsedStartTime = card.startTime ? new Date(card.startTime) : null
    const isValidTime = Boolean(parsedStartTime && !Number.isNaN(parsedStartTime.getTime()))
    const timeLabel = isValidTime ? timeLabelFormatter.format(parsedStartTime as Date) : 'TBD'
    const isExpanded = effectiveOpenCardId === card.id
    const selectedButtonKey = resolveDisplayButtonKey(
      card,
      selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card),
    )
    const selectedButton = resolveSelectedButton(card, selectedButtonKey)
    const isSpreadOrTotalSelected = selectedButton?.marketType === 'spread' || selectedButton?.marketType === 'total'
    const isFinalizedCard = card.event.sports_ended === true
    const parsedFinalScore = parseSportsScore(card.event.sports_score)
    const teamScores = [
      parsedFinalScore?.team1 ?? null,
      parsedFinalScore?.team2 ?? null,
    ]
    const winningTeamIndex = (
      teamScores[0] != null
      && teamScores[1] != null
      && teamScores[0] !== teamScores[1]
    )
      ? (teamScores[0] > teamScores[1] ? 0 : 1)
      : null
    const shouldRenderDetailsPanel = isExpanded && (effectiveIsDetailsContentVisible || isSpreadOrTotalSelected)
    const activeMarketType = resolveActiveMarketType(card, selectedButtonKey)
    const buttonGroups = groupButtonsByMarketType(card.buttons)
    const shouldUseClosedDetailsSpacing = Boolean(
      selectedButton
      && (selectedButton.marketType === 'spread' || selectedButton.marketType === 'total')
      && new Set(buttonGroups[selectedButton.marketType].map(button => button.conditionId)).size > 1,
    )
    const hasPrimaryMarketTrio = hasSportsGamesCardPrimaryMarketTrio(card)
    const shouldCollapseCardControlsToMoneylineOnly = !showSpreadsAndTotals || !hasPrimaryMarketTrio
    const cardVisibleMarketColumns = resolveSportsGamesCardVisibleMarketTypes(card, showSpreadsAndTotals)
      .map(marketType => MARKET_COLUMN_BY_KEY.get(marketType))
      .filter((column): column is { key: SportsGamesMarketType, label: string } => Boolean(column))
    const hasLivestreamUrl = Boolean(card.event.livestream_url?.trim())
    const canWatchLivestream = (
      options.topBadgeMode === 'live'
      && hasLivestreamUrl
      && card.event.sports_ended !== true
      && card.event.sports_live !== false
    )

    return (
      <article
        className={cn(
          `
            cursor-pointer overflow-hidden rounded-xl border bg-card px-2.5 pt-2.5 shadow-md shadow-black/4
            transition-all
          `,
        )}
      >
        <div
          className={cn(
            `-mx-2.5 -mt-2.5 bg-card px-2.5 pt-2.5 transition-colors hover:bg-secondary/30`,
            shouldRenderDetailsPanel ? 'rounded-t-xl' : 'rounded-xl',
            isFinalizedCard ? 'pb-3' : 'pb-2.5',
          )}
          role="button"
          tabIndex={0}
          onClick={event => toggleCard(card, event)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggleCard(card, event)
            }
          }}
        >
          <div className="mb-2 flex items-start justify-between gap-2 sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {options.topBadgeMode === 'live'
                ? isFinalizedCard
                  ? (
                      <span className="
                        rounded-sm bg-secondary px-2 py-1 text-xs font-semibold text-foreground uppercase
                      "
                      >
                        FINAL
                      </span>
                    )
                  : (
                      <span className="flex items-center gap-1.5">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-2 animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                        </span>
                        <span className="text-xs leading-none font-medium text-red-500 uppercase">LIVE</span>
                      </span>
                    )
                : isFinalizedCard
                  ? (
                      <span className="
                        rounded-sm bg-secondary px-2 py-1 text-xs font-semibold text-foreground uppercase
                      "
                      >
                        FINAL
                      </span>
                    )
                  : (
                      <span className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-foreground">
                        {timeLabel}
                      </span>
                    )}
              <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <span className="shrink-0">
                  {formatVolume(card.volume)}
                  {' '}
                  Vol.
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-2 sm:items-center">
              {canWatchLivestream && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-sports-card-control="true"
                      onClick={(event) => {
                        event.stopPropagation()
                        openLivestream({
                          url: card.event.livestream_url!,
                          title: card.event.title || card.title,
                        })
                      }}
                      className={cn(
                        `
                          inline-flex size-8 items-center justify-center rounded-lg bg-secondary/80 text-foreground
                          transition-colors
                        `,
                        'hover:bg-secondary hover:ring-1 hover:ring-border',
                      )}
                      aria-label="Watch Livestream"
                    >
                      <RadioIcon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Watch Livestream
                  </TooltipContent>
                </Tooltip>
              )}

              <AppLink
                intentPrefetch
                href={card.eventHref}
                data-sports-card-control="true"
                onClick={event => event.stopPropagation()}
                className={cn(
                  `
                    inline-flex shrink-0 items-center gap-1 rounded-lg bg-secondary/80 px-2 py-1.5 text-xs font-semibold
                    text-foreground transition-colors
                    sm:px-2.5
                  `,
                  'hover:bg-secondary hover:ring-1 hover:ring-border',
                )}
              >
                {card.marketsCount > 0 && (
                  <span
                    className={cn(
                      `
                        inline-flex size-5 items-center justify-center rounded-sm bg-muted text-2xs font-semibold
                        text-foreground/80
                      `,
                    )}
                  >
                    {card.marketsCount}
                  </span>
                )}
                <span>Game View</span>
                <ChevronRightIcon className="size-3.5" />
              </AppLink>
            </div>
          </div>

          <div className={cn(`
            flex flex-col gap-2.5
            min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between
          `)}
          >
            <div className={cn('min-w-0 flex-1', isFinalizedCard ? 'space-y-3 pt-0.5' : 'space-y-2')}>
              {card.teams.map((team, teamIndex) => {
                const useCroppedTeamLogo = shouldUseCroppedSportsTeamLogo(card.event.sports_sport_slug)
                const isWinner = winningTeamIndex === teamIndex
                const isLoser = winningTeamIndex != null && winningTeamIndex !== teamIndex
                const teamScore = teamScores[teamIndex]

                if (isFinalizedCard) {
                  return (
                    <div
                      key={`${card.id}-${team.abbreviation}-${team.name}`}
                      className="flex items-center gap-2.5 py-0.5"
                    >
                      <span
                        className={cn(
                          `
                            inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1.5 text-sm
                            font-bold tabular-nums
                          `,
                          isWinner ? 'bg-foreground text-background' : 'bg-secondary text-foreground',
                          isLoser && 'opacity-75',
                        )}
                      >
                        {teamScore ?? '—'}
                      </span>

                      <div
                        className={cn(
                          useCroppedTeamLogo
                            ? 'relative h-7 w-12 shrink-0 overflow-hidden rounded-sm'
                            : 'flex size-6 shrink-0 items-center justify-center',
                          isLoser && 'opacity-55',
                        )}
                      >
                        {team.logoUrl
                          ? (
                              useCroppedTeamLogo
                                ? (
                                    <Image
                                      src={team.logoUrl}
                                      alt={`${team.name} logo`}
                                      fill
                                      sizes="48px"
                                      className="scale-[1.08] object-cover object-center"
                                    />
                                  )
                                : (
                                    <Image
                                      src={team.logoUrl}
                                      alt={`${team.name} logo`}
                                      width={24}
                                      height={24}
                                      sizes="20px"
                                      className="size-[92%] object-contain object-center"
                                    />
                                  )
                            )
                          : (
                              <div
                                className={cn(
                                  'flex size-full items-center justify-center border text-2xs font-semibold',
                                  useCroppedTeamLogo ? 'rounded-sm bg-secondary' : 'rounded-sm',
                                  'border-border/40 text-muted-foreground',
                                )}
                              >
                                {team.abbreviation.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                      </div>

                      <span className={cn('truncate text-sm font-semibold', isLoser && 'opacity-55')}>
                        {team.name}
                      </span>

                      {team.record && (
                        <span
                          className={cn(
                            'shrink-0 text-xs text-muted-foreground',
                            isLoser && 'opacity-55',
                          )}
                        >
                          {team.record}
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={`${card.id}-${team.abbreviation}-${team.name}`}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={cn(
                        useCroppedTeamLogo
                          ? 'relative h-7 w-12 shrink-0 overflow-hidden rounded-sm'
                          : 'flex size-6 shrink-0 items-center justify-center',
                      )}
                    >
                      {team.logoUrl
                        ? (
                            useCroppedTeamLogo
                              ? (
                                  <Image
                                    src={team.logoUrl}
                                    alt={`${team.name} logo`}
                                    fill
                                    sizes="48px"
                                    className="scale-[1.08] object-cover object-center"
                                  />
                                )
                              : (
                                  <Image
                                    src={team.logoUrl}
                                    alt={`${team.name} logo`}
                                    width={24}
                                    height={24}
                                    sizes="20px"
                                    className="size-[92%] object-contain object-center"
                                  />
                                )
                          )
                        : (
                            <div
                              className={cn(
                                `
                                  flex size-full items-center justify-center border border-border/40 text-2xs
                                  font-semibold text-muted-foreground
                                `,
                                useCroppedTeamLogo ? 'rounded-sm bg-secondary' : 'rounded-sm',
                              )}
                            >
                              {team.abbreviation.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                    </div>

                    <span className="truncate text-sm font-semibold text-foreground">
                      {team.name}
                    </span>

                    {team.record && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {team.record}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {!isFinalizedCard && (
              <div
                data-sports-card-control="true"
                className={cn(
                  'grid grid-cols-1 gap-2',
                  shouldCollapseCardControlsToMoneylineOnly
                    ? (
                        showSpreadsAndTotals
                          ? 'w-full min-[1200px]:w-[372px] sm:ml-auto'
                          : 'w-full sm:ml-auto sm:w-auto sm:justify-items-end'
                      )
                    : 'min-[1200px]:w-[372px] sm:grid-cols-3',
                )}
              >
                {cardVisibleMarketColumns.map((column) => {
                  const columnButtons = buttonGroups[column.key]
                  if (columnButtons.length === 0) {
                    return null
                  }

                  const isMoneylineOnlyLayout = shouldCollapseCardControlsToMoneylineOnly && column.key === 'moneyline'
                  let renderedButtons = columnButtons

                  if (column.key !== 'moneyline') {
                    const buttonsByConditionId = new Map<string, typeof columnButtons>()
                    for (const button of columnButtons) {
                      const existing = buttonsByConditionId.get(button.conditionId)
                      if (existing) {
                        existing.push(button)
                        continue
                      }
                      buttonsByConditionId.set(button.conditionId, [button])
                    }

                    const orderedConditionIds = Array.from(buttonsByConditionId.keys())
                    const activeConditionId = selectedButton?.marketType === column.key
                      ? selectedButton.conditionId
                      : orderedConditionIds[0]

                    const selectedButtons = buttonsByConditionId.get(activeConditionId ?? '')
                      ?? (orderedConditionIds[0] ? buttonsByConditionId.get(orderedConditionIds[0]) : [])
                      ?? []

                    renderedButtons = selectedButtons

                    if (column.key === 'spread') {
                      const spreadOrder: Record<string, number> = {
                        team1: 0,
                        team2: 1,
                        draw: 2,
                        over: 3,
                        under: 4,
                        neutral: 5,
                      }

                      renderedButtons = [...selectedButtons].sort((a, b) => (
                        (spreadOrder[a.tone] ?? 99) - (spreadOrder[b.tone] ?? 99)
                      ))
                    }
                  }

                  if (renderedButtons.length === 0) {
                    return null
                  }

                  return (
                    <div
                      key={`${card.id}-${column.key}`}
                      className={cn(
                        'w-full gap-2',
                        isMoneylineOnlyLayout
                          ? cn(
                              'grid sm:flex sm:flex-wrap sm:justify-end',
                              resolveMoneylineButtonGridClass(renderedButtons.length),
                            )
                          : 'flex flex-col',
                      )}
                    >
                      {renderedButtons.map((button) => {
                        const isActiveColumn = activeMarketType === button.marketType
                        const isMoneylineColumn = button.marketType === 'moneyline'
                        const hasTeamColor = isActiveColumn
                          && (button.tone === 'team1' || button.tone === 'team2')
                        const isOverButton = isActiveColumn && button.tone === 'over'
                        const isUnderButton = isActiveColumn && button.tone === 'under'
                        const buttonOverlayStyle = hasTeamColor
                          ? resolveButtonOverlayStyle(button.color, button.tone)
                          : undefined

                        return (
                          <div
                            key={button.key}
                            className={cn(
                              'relative overflow-hidden rounded-lg pb-1.25',
                              isMoneylineOnlyLayout
                                ? 'w-full min-w-0 sm:w-auto sm:min-w-[104px] sm:shrink-0'
                                : 'w-full',
                            )}
                          >
                            <div
                              className={cn(
                                'pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg',
                                !hasTeamColor && !isOverButton && !isUnderButton && 'bg-border/70',
                                isOverButton && 'bg-yes/70',
                                isUnderButton && 'bg-no/70',
                              )}
                              style={hasTeamColor ? resolveButtonDepthStyle(button.color, button.tone) : undefined}
                            />
                            <button
                              type="button"
                              data-sports-card-control="true"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                const panelMode = column.key === 'moneyline'
                                  ? 'full'
                                  : (isExpanded ? 'preserve' : 'partial')
                                selectCardButton(card, button.key, {
                                  panelMode,
                                })
                              }}
                              style={hasTeamColor ? resolveButtonStyle(button.color, button.tone) : undefined}
                              className={cn(
                                `
                                  relative flex w-full translate-y-0 items-center justify-center rounded-lg px-2
                                  font-semibold shadow-sm transition-transform duration-150 ease-out
                                  hover:translate-y-px
                                  active:translate-y-0.5
                                `,
                                isMoneylineOnlyLayout
                                  ? 'h-11 text-xs'
                                  : (isMoneylineColumn ? 'h-9 text-xs' : 'h-[58px] text-xs'),
                                !hasTeamColor && !isOverButton && !isUnderButton
                                && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                              )}
                            >
                              {buttonOverlayStyle
                                ? <span className="pointer-events-none absolute inset-0 rounded-lg" style={buttonOverlayStyle} />
                                : null}
                              <span className={cn('relative z-1 opacity-80', isMoneylineColumn ? 'mr-1' : 'mr-2')}>
                                {button.label}
                              </span>
                              <span className="relative z-1 text-sm leading-none tabular-nums">
                                {formatButtonOdds(buttonPriceCentsByKey.get(`${card.id}:${button.key}`) ?? button.cents)}
                              </span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {(!isFinalizedCard || shouldRenderDetailsPanel) && (
          <div
            className={cn(
              '-mx-2.5 bg-card px-2.5 empty:hidden',
              shouldRenderDetailsPanel
                ? 'border-t pt-3'
                : (shouldUseClosedDetailsSpacing ? 'pt-3' : 'pt-0'),
            )}
            onClick={event => event.stopPropagation()}
          >
            <SportsGameDetailsPanel
              card={card}
              activeDetailsTab={activeDetailsTab}
              selectedButtonKey={selectedButtonKey}
              showBottomContent={shouldRenderDetailsPanel ? effectiveIsDetailsContentVisible : false}
              defaultGraphTimeRange={pageMode === 'games' ? '1H' : '1W'}
              oddsFormat={oddsFormat}
              onChangeTab={setActiveDetailsTab}
              onSelectButton={(buttonKey, renderOptions) => selectCardButton(card, buttonKey, renderOptions)}
            />
          </div>
        )}
      </article>
    )
  }

  const weekSelect = (
    <Select
      value={effectiveSelectedWeek}
      onValueChange={setSelectedWeek}
      disabled={weekOptions.length === 0}
    >
      <SelectTrigger
        className={cn(
          `
            h-12 w-fit min-w-0 cursor-pointer rounded-full border-0 bg-card px-3.5 pr-2 text-sm font-semibold
            text-foreground shadow-none
            hover:bg-card
            data-[size=default]:h-12!
            dark:bg-card
            dark:hover:bg-card
          `,
        )}
      >
        <SelectValue placeholder="Week" />
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="min-w-36 p-1">
        {weekOptions.map(week => (
          <SelectItem key={week} value={String(week)} className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
            {`Week ${week}`}
          </SelectItem>
        ))}
        {weekOptions.length === 0 && (
          <SelectItem value="all" className="my-0.5 cursor-pointer rounded-sm py-1.5 pl-2">
            No weeks
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )

  function renderSearchControl(className?: string, options?: { pill?: boolean }) {
    const isPillVariant = options?.pill === true

    return (
      <div
        ref={searchShellRef}
        className={cn(
          'relative isolate z-0 flex items-center',
          isPillVariant ? 'h-12' : 'h-11',
          className,
        )}
      >
        <div
          className={cn(
            `
              absolute top-0 right-0 z-10 flex origin-right items-center overflow-hidden bg-card
              transition-[width,opacity,transform,padding] duration-300 ease-out
            `,
            isPillVariant ? 'h-12 rounded-sm' : 'h-11 rounded-sm',
            isSearchOpen
              ? 'w-56 translate-x-0 scale-x-100 px-3 opacity-100'
              : 'pointer-events-none w-0 translate-x-1.5 scale-x-95 px-0 opacity-0',
          )}
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                if (searchQuery.trim()) {
                  setSearchQuery('')
                }
                else {
                  setIsSearchOpen(false)
                }
              }
            }}
            className={cn(
              `
                ml-2 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none
                placeholder:text-muted-foreground
              `,
            )}
          />
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setSearchQuery('')
              setIsSearchOpen(false)
            }}
            className={cn(
              `
                ml-2 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors
                hover:bg-muted/80 hover:text-foreground
              `,
            )}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          aria-label="Open search"
          data-sports-card-control="true"
          onClick={() => {
            if (!isSearchOpen) {
              setIsSearchOpen(true)
              return
            }
            searchInputRef.current?.focus()
          }}
          className={cn(
            headerIconButtonClass,
            'relative',
            isSearchOpen && 'pointer-events-none opacity-0',
            isPillVariant && 'size-12 rounded-sm border-0 bg-transparent text-foreground hover:bg-card',
          )}
        >
          <SearchIcon className="size-4" />
        </button>
      </div>
    )
  }

  function renderSettingsMenu() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Odds format settings"
            className={headerIconButtonClass}
          >
            <SettingsIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-64 border border-border bg-background p-1 text-foreground shadow-xl"
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
            Odds Format
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ODDS_FORMAT_OPTIONS.map(option => (
            <DropdownMenuItem
              key={option.value}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-foreground"
              onSelect={(event) => {
                event.preventDefault()
                setOddsFormat(option.value)
              }}
            >
              <span>{option.label}</span>
              {oddsFormat === option.value && <CheckIcon className="ml-auto size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer rounded-sm px-2 py-1.5 text-sm whitespace-nowrap text-foreground"
            onSelect={(event) => {
              event.preventDefault()
              setShowSpreadsAndTotals(current => !current)
            }}
          >
            <span>Show Spreads + Totals</span>
            {showSpreadsAndTotals && <CheckIcon className="ml-auto size-3.5 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <div className={cn(
        `
          min-[1200px]:grid min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem]
          min-[1200px]:grid-rows-[minmax(0,1fr)] min-[1200px]:[align-content:start] min-[1200px]:items-stretch
          min-[1200px]:gap-6
        `,
      )}
      >
        <section
          data-sports-scroll-pane="center"
          className={cn(
            `
              min-w-0
              min-[1200px]:ml-4 min-[1200px]:min-h-0 min-[1200px]:self-stretch min-[1200px]:overflow-y-auto
              min-[1200px]:overscroll-contain min-[1200px]:pr-1
            `,
          )}
        >
          <div className="mb-3">
            {showHeading
              ? (
                  <div className={cn(
                    'mb-3 flex items-start justify-between gap-3',
                    !isFeedPage && 'min-[1200px]:mt-2',
                  )}
                  >
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                      {sportTitle}
                    </h1>

                    <div className="flex items-center gap-2">
                      {isFeedPage && renderSearchControl()}
                      {renderSettingsMenu()}
                    </div>
                  </div>
                )
              : (
                  <div className="mb-3 flex items-center justify-end gap-2">
                    {isFeedPage && renderSearchControl()}
                    {renderSettingsMenu()}
                  </div>
                )}
            {!showHeading && !isFeedPage && (
              <div className="sr-only">
                {sportTitle}
              </div>
            )}

            {!isFeedPage && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(`${verticalConfig.basePath}/${sportSlug}/games` as Route)}
                    className={cn(
                      `
                        rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground
                        transition-colors
                      `,
                    )}
                  >
                    Games
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`${verticalConfig.basePath}/${sportSlug}/props` as Route)}
                    className="rounded-full bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors"
                  >
                    Props
                  </button>
                </div>

                <div className="ml-auto flex min-w-0 items-center justify-end">
                  {renderSearchControl('mr-2', { pill: true })}

                  {weekSelect}
                </div>
              </div>
            )}
          </div>

          {!isFeedPage && groupedCards.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              {emptyStateLabel}
            </div>
          )}

          {isFeedPage && !hasFeedResults && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              {emptyStateLabel}
            </div>
          )}

          {!isFeedPage
            ? (
                <div className="space-y-5">
                  {groupedCards.map(group => (
                    <div key={group.key}>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <p className="text-lg font-semibold text-foreground">
                          {group.label}
                        </p>
                        {renderMarketColumnsHeader(group.key, group.cards)}
                      </div>

                      <div className="space-y-2">
                        {group.cards.map(card => (
                          <div key={card.id}>
                            {renderCard(card, {
                              topBadgeMode: isCardLiveNow(card, currentTimestampMs) ? 'live' : 'time',
                              categoryLabel: resolveCardCategory(card),
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            : isLivePage
              ? (
                  <div className="space-y-5">
                    {liveCardsByCategory.map(categoryGroup => (
                      <div key={`live-${categoryGroup.key}`}>
                        <div className="mb-2 flex items-end justify-between gap-3">
                          <p className="text-base font-semibold text-foreground">
                            {categoryGroup.label}
                          </p>
                          {renderMarketColumnsHeader(`live-${categoryGroup.key}`, categoryGroup.cards)}
                        </div>

                        <div className="space-y-2">
                          {categoryGroup.cards.map(card => (
                            <div key={card.id}>
                              {renderCard(card, {
                                topBadgeMode: 'live',
                                categoryLabel: categoryGroup.label,
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              : isSoonPage
                ? (
                    <div className="space-y-3">
                      {startingSoonGroupsByDate.map(dateGroup => (
                        <div key={`soon-${dateGroup.key}`} className="space-y-2.5">
                          <p className="text-lg font-semibold text-foreground">
                            {dateGroup.label}
                          </p>

                          <div className="space-y-3">
                            {dateGroup.categories.map(categoryGroup => (
                              <div key={`soon-${dateGroup.key}-${categoryGroup.key}`}>
                                <div className="mb-1.5 flex items-end justify-between gap-3">
                                  <p className="text-base font-semibold text-foreground">
                                    {categoryGroup.label}
                                  </p>
                                  {renderMarketColumnsHeader(
                                    `soon-${dateGroup.key}-${categoryGroup.key}`,
                                    categoryGroup.cards,
                                  )}
                                </div>

                                <div className="space-y-2">
                                  {categoryGroup.cards.map(card => (
                                    <div key={card.id}>
                                      {renderCard(card, {
                                        topBadgeMode: 'time',
                                        categoryLabel: categoryGroup.label,
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                : (
                    <div className="space-y-6">
                      {liveCardsByCategory.length > 0
                        ? (
                            <div className="space-y-5">
                              {liveCardsByCategory.map(categoryGroup => (
                                <div key={`live-${categoryGroup.key}`}>
                                  <div className="mb-2 flex items-end justify-between gap-3">
                                    <p className="text-base font-semibold text-foreground">
                                      {categoryGroup.label}
                                    </p>
                                    {renderMarketColumnsHeader(`live-${categoryGroup.key}`, categoryGroup.cards)}
                                  </div>

                                  <div className="space-y-2">
                                    {categoryGroup.cards.map(card => (
                                      <div key={card.id}>
                                        {renderCard(card, {
                                          topBadgeMode: 'live',
                                          categoryLabel: categoryGroup.label,
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        : startingSoonGroupsByDate.length > 0
                          ? (
                              <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                                {liveSectionEmptyStateLabel}
                              </div>
                            )
                          : null}

                      {startingSoonGroupsByDate.length > 0 && (
                        <div className="space-y-3">
                          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            Upcoming Games
                          </h2>

                          {startingSoonGroupsByDate.map(dateGroup => (
                            <div key={`soon-${dateGroup.key}`} className="space-y-2.5">
                              <p className="text-lg font-semibold text-foreground">
                                {dateGroup.label}
                              </p>

                              <div className="space-y-3">
                                {dateGroup.categories.map(categoryGroup => (
                                  <div key={`soon-${dateGroup.key}-${categoryGroup.key}`}>
                                    <div className="mb-1.5 flex items-end justify-between gap-3">
                                      <p className="text-base font-semibold text-foreground">
                                        {categoryGroup.label}
                                      </p>
                                      {renderMarketColumnsHeader(
                                        `soon-${dateGroup.key}-${categoryGroup.key}`,
                                        categoryGroup.cards,
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      {categoryGroup.cards.map(card => (
                                        <div key={card.id}>
                                          {renderCard(card, {
                                            topBadgeMode: 'time',
                                            categoryLabel: categoryGroup.label,
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
        </section>

        <aside
          data-sports-scroll-pane="aside"
          className={cn(
            `
              hidden gap-4
              min-[1200px]:sticky min-[1200px]:top-0 min-[1200px]:block min-[1200px]:h-fit min-[1200px]:max-h-full
              min-[1200px]:self-start min-[1200px]:overflow-y-auto
            `,
          )}
        >
          {activeTradeContext
            ? (
                <div className="grid gap-6">
                  <EventOrderPanelForm
                    isMobile={false}
                    event={activeTradeContext.card.event}
                    oddsFormat={oddsFormat}
                    outcomeButtonStyleVariant="sports3d"
                    outcomeLabelOverrides={orderPanelOutcomeLabelOverrides}
                    outcomeAccentOverrides={orderPanelOutcomeAccentOverrides}
                    desktopMarketInfo={(
                      <SportsOrderPanelMarketInfo
                        card={activeTradeHeaderContext?.card ?? activeTradeContext.card}
                        selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
                        selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
                        marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
                      />
                    )}
                    primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
                  />
                  <EventOrderPanelTermsDisclaimer />
                </div>
              )
            : (
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  Select a market to trade.
                </div>
              )}
        </aside>
      </div>

      {isMobile && activeTradeContext && (
        <EventOrderPanelMobile
          event={activeTradeContext.card.event}
          showDefaultTrigger={false}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant="sports3d"
          outcomeLabelOverrides={orderPanelOutcomeLabelOverrides}
          outcomeAccentOverrides={orderPanelOutcomeAccentOverrides}
          mobileMarketInfo={(
            <SportsOrderPanelMarketInfo
              card={activeTradeHeaderContext?.card ?? activeTradeContext.card}
              selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
              selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
              marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
            />
          )}
          primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
        />
      )}

      <SportsLivestreamFloatingPlayer />
    </>
  )
}
