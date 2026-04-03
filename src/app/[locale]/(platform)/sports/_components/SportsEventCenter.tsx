'use client'

import type { SportsGamesMarketType, SportsLinePickerOption } from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import type { SportsRedeemModalGroup, SportsRedeemModalSection } from '@/app/[locale]/(platform)/sports/_components/SportsRedeemModal'
import type {
  SportsGamesButton,
  SportsGamesCard,
  SportsGamesCardMarketView,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { OddsFormat } from '@/lib/odds-format'
import type { SportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import type { SportsVertical } from '@/lib/sports-vertical'
import type { UserPosition } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ShareIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import SportsEventAboutPanel from '@/app/[locale]/(platform)/sports/_components/SportsEventAboutPanel'
import { buildLinePickerOptions, groupButtonsByMarketType, resolveButtonDepthStyle, resolveButtonOverlayStyle, resolveButtonStyle, resolveDefaultConditionId, resolveOrderPanelOutcomeAccentOverrides, resolveOrderPanelOutcomeLabelOverrides, resolvePreferredLinePickerButton, resolveSelectedButton, resolveSelectedMarket, resolveSelectedOutcome, resolveStableSpreadPrimaryOutcomeIndex, SportsGameDetailsPanel, SportsGameGraph, SportsOrderPanelMarketInfo } from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import SportsLivestreamFloatingPlayer
  from '@/app/[locale]/(platform)/sports/_components/SportsLivestreamFloatingPlayer'
import SportsRedeemModal from '@/app/[locale]/(platform)/sports/_components/SportsRedeemModal'
import { buildMarketSlugSelectionSignature } from '@/app/[locale]/(platform)/sports/_utils/sports-event-selection'
import {
  resolveSportsAuxiliaryMarketGroupKey,
  resolveSportsAuxiliaryMarketTitle,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import AppLink from '@/components/AppLink'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserPositionsForMarket } from '@/lib/data-api/user'
import { formatVolume } from '@/lib/formatters'
import { resolveOutcomePriceCents, resolveOutcomeSelectionPriceCents } from '@/lib/market-pricing'
import { formatOddsFromCents, ODDS_FORMAT_OPTIONS } from '@/lib/odds-format'
import { shouldUseCroppedSportsTeamLogo } from '@/lib/sports-team-logo'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useSportsLivestream } from '@/stores/useSportsLivestream'
import { useUser } from '@/stores/useUser'

type DetailsTab = 'orderBook' | 'graph' | 'about'
type EventSectionKey = Extract<SportsGamesMarketType, 'moneyline' | 'spread' | 'total' | 'btts'>
type EsportsLayoutTabKey = 'series' | `segment-${number}`

interface SportsEventCenterProps {
  card: SportsGamesCard
  marketViewCards?: SportsGamesCardMarketView[]
  relatedCards?: SportsGamesCard[]
  marketContextEnabled?: boolean
  sportSlug: string
  sportLabel: string
  initialMarketSlug?: string | null
  initialMarketViewKey?: SportsEventMarketViewKey | null
  vertical?: SportsVertical
}

interface SportsEventQuerySelection {
  conditionId: string | null
  outcomeIndex: number | null
}

interface AuxiliaryMarketPanel {
  key: string
  title: string
  markets: SportsGamesCard['detailMarkets']
  buttons: SportsGamesButton[]
  volume: number
  mapNumber: number | null
}

interface SportsSegmentNumberPickerOption {
  key: string
  label: string
  number: number
}

const SECTION_ORDER: Array<{ key: EventSectionKey, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Totals' },
  { key: 'btts', label: 'Both Teams to Score?' },
]

const headerIconButtonClass = `
  size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors
  hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9
`
const SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY = 'sports:event:odds-format'
const EMPTY_QUERY_SELECTION: SportsEventQuerySelection = {
  conditionId: null,
  outcomeIndex: null,
}

function areRecordValuesEqual<T extends string | null | undefined>(
  left: Record<string, T>,
  right: Record<string, T>,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every(key => left[key] === right[key])
}

function parseRequestedOutcomeIndex(value: string | null | undefined) {
  const rawValue = value?.trim() ?? ''
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeSportsMarketType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function resolveMoneylineButtonGridClass(buttonCount: number) {
  if (buttonCount <= 1) {
    return 'grid-cols-1'
  }

  if (buttonCount === 2) {
    return 'grid-cols-2'
  }

  return 'grid-cols-3'
}

function parseEsportsSegmentDescriptor(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  if (!market) {
    return null
  }

  const segmentMatch = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
    market.slug,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .match(/\b(map|game)\s*(\d+)\b/i)

  if (!segmentMatch?.[1] || !segmentMatch[2]) {
    return null
  }

  const parsed = Number.parseInt(segmentMatch[2], 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return {
    kind: segmentMatch[1].toLowerCase() === 'map' ? 'map' : 'game',
    number: parsed,
  } as const
}

function parseEsportsSegmentNumber(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return parseEsportsSegmentDescriptor(market)?.number ?? null
}

function isSegmentedEsportsEventCard(card: SportsGamesCard, vertical: SportsVertical) {
  return vertical === 'esports'
    && card.detailMarkets.some(market => parseEsportsSegmentDescriptor(market) != null)
}

function resolveEsportsSegmentLabels(card: SportsGamesCard) {
  const segmentKinds = new Set(
    card.detailMarkets
      .map(market => parseEsportsSegmentDescriptor(market)?.kind ?? null)
      .filter((kind): kind is 'map' | 'game' => kind === 'map' || kind === 'game'),
  )

  if (segmentKinds.size === 1) {
    const [kind] = Array.from(segmentKinds)
    return kind === 'map'
      ? { singular: 'Map', plural: 'Maps' }
      : { singular: 'Game', plural: 'Games' }
  }

  return { singular: 'Game', plural: 'Games' }
}

function isSegmentedEsportsChildMoneylineMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return normalizeSportsMarketType(market?.sports_market_type) === 'child_moneyline'
}

function isSegmentedEsportsBinaryMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  return parseEsportsSegmentNumber(market) != null && !isSegmentedEsportsChildMoneylineMarket(market)
}

function isSegmentedEsportsPrimaryMoneylineMarket(market: SportsGamesCard['detailMarkets'][number] | null | undefined) {
  if (!market || isSegmentedEsportsChildMoneylineMarket(market)) {
    return false
  }

  const normalizedType = normalizeSportsMarketType(market.sports_market_type)
  if (normalizedType === 'moneyline') {
    return true
  }

  const marketText = [
    market.sports_group_item_title,
    market.short_title,
    market.title,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()

  return marketText.includes('match winner') || marketText.includes('moneyline')
}

function resolveEsportsSegmentTabKey(mapNumber: number): EsportsLayoutTabKey {
  return `segment-${mapNumber}`
}

function parseEsportsSegmentTabNumber(tabKey: EsportsLayoutTabKey) {
  if (tabKey === 'series') {
    return null
  }

  const parsed = Number.parseInt(tabKey.slice(8), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function resolveEsportsSegmentPanelTitle(markets: SportsGamesCard['detailMarkets']) {
  const primaryMarket = markets[0]
  if (!primaryMarket) {
    return 'Market'
  }

  return primaryMarket.short_title?.trim()
    || primaryMarket.sports_group_item_title?.trim()
    || primaryMarket.title
}

function resolveEsportsSegmentPanelSortOrder(markets: SportsGamesCard['detailMarkets']) {
  const normalizedType = normalizeSportsMarketType(markets[0]?.sports_market_type)
  if (normalizedType === 'child_moneyline') {
    return 0
  }
  if (normalizedType === 'spread' || normalizedType === 'map_handicap' || normalizedType.includes('handicap')) {
    return 1
  }
  if (normalizedType === 'total' || normalizedType === 'totals' || normalizedType.includes('total')) {
    return 2
  }
  if (normalizedType.endsWith('odd_even_total_kills')) {
    return 3
  }
  if (normalizedType.endsWith('odd_even_total_rounds')) {
    return 4
  }
  return 99
}

function SportsSegmentNumberPicker({
  options,
  activeNumber,
  segmentLabel,
  onPick,
}: {
  options: SportsSegmentNumberPickerOption[]
  activeNumber: number | null
  segmentLabel: string
  onPick: (number: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [startSpacer, setStartSpacer] = useState(0)
  const [endSpacer, setEndSpacer] = useState(0)

  const activeOptionIndex = useMemo(
    () => options.findIndex(option => option.number === activeNumber),
    [activeNumber, options],
  )

  const pickOption = useCallback((optionIndex: number) => {
    const option = options[optionIndex]
    if (!option) {
      return
    }

    onPick(option.number)
  }, [onPick, options])

  const handlePickPrevious = useCallback(() => {
    if (activeOptionIndex <= 0) {
      return
    }

    pickOption(activeOptionIndex - 1)
  }, [activeOptionIndex, pickOption])

  const handlePickNext = useCallback(() => {
    if (activeOptionIndex < 0 || activeOptionIndex >= options.length - 1) {
      return
    }

    pickOption(activeOptionIndex + 1)
  }, [activeOptionIndex, options.length, pickOption])

  const alignActiveOption = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (activeOptionIndex < 0) {
      return
    }

    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }

    const activeOption = options[activeOptionIndex]
    if (!activeOption) {
      return
    }

    const activeButton = buttonRefs.current[activeOption.key]
    if (!activeButton) {
      return
    }

    const targetLeft = activeButton.offsetLeft - ((scroller.clientWidth - activeButton.offsetWidth) / 2)
    scroller.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    })
  }, [activeOptionIndex, options])

  const updateSpacers = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || options.length === 0) {
      setStartSpacer(0)
      setEndSpacer(0)
      return
    }

    const firstOptionKey = options[0]?.key
    const lastOptionKey = options.at(-1)?.key
    const firstButton = firstOptionKey ? buttonRefs.current[firstOptionKey] : null
    const lastButton = lastOptionKey ? buttonRefs.current[lastOptionKey] : null
    const fallbackButtonWidth = 40
    const inferredButtonWidth = firstButton?.offsetWidth
      ?? lastButton?.offsetWidth
      ?? fallbackButtonWidth
    const firstButtonWidth = firstButton?.offsetWidth ?? inferredButtonWidth
    const lastButtonWidth = lastButton?.offsetWidth ?? inferredButtonWidth
    const viewportWidth = scroller.clientWidth
    const scrollerStyles = window.getComputedStyle(scroller)
    const gapWidth = Number.parseFloat(scrollerStyles.columnGap || scrollerStyles.gap || '0') || 0
    const startSpacerWidth = Math.max(0, viewportWidth / 2 - firstButtonWidth / 2 - gapWidth)
    const endSpacerWidth = Math.max(0, viewportWidth / 2 - lastButtonWidth / 2 - gapWidth)

    setStartSpacer(startSpacerWidth)
    setEndSpacer(endSpacerWidth)
  }, [options])

  useEffect(() => {
    if (activeOptionIndex < 0) {
      return
    }

    alignActiveOption('auto')
  }, [activeOptionIndex, alignActiveOption, endSpacer, startSpacer])

  useEffect(() => {
    if (options.length <= 1) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      updateSpacers()
      alignActiveOption('auto')
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [alignActiveOption, options.length, updateSpacers])

  useEffect(() => {
    const scrollerElement = scrollerRef.current
    if (options.length <= 1 || !scrollerElement) {
      return
    }

    updateSpacers()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSpacers)
      return () => {
        window.removeEventListener('resize', updateSpacers)
      }
    }

    const observer = new ResizeObserver(updateSpacers)
    observer.observe(scrollerElement)
    return () => {
      observer.disconnect()
    }
  }, [options.length, updateSpacers])

  if (options.length <= 1) {
    return null
  }

  return (
    <div className="bg-card px-2.5 pb-2">
      <div className="-mx-2.5 border-t border-border/70" />
      <div className="pt-2">
        <div className="mt-0.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePickPrevious}
            disabled={activeOptionIndex <= 0}
            className={cn(
              `
                inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
              `,
              activeOptionIndex > 0
                ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Previous ${segmentLabel.toLowerCase()}`}
          >
            <ChevronLeftIcon className="size-4.5" />
          </button>

          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="
                pointer-events-none absolute -top-2 left-1/2 h-2 w-3 -translate-x-1/2 bg-primary
                [clip-path:polygon(50%_100%,0_0,100%_0)]
              "
            />

            <div
              ref={scrollerRef}
              className={`
                flex min-w-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              `}
            >
              <span aria-hidden className="shrink-0" style={{ width: startSpacer }} />
              {options.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => pickOption(index)}
                  ref={(node) => {
                    buttonRefs.current[option.key] = node
                  }}
                  className={cn(
                    `w-10 shrink-0 snap-center text-center text-sm font-medium text-muted-foreground transition-colors`,
                    index === activeOptionIndex
                      ? 'text-base font-semibold text-foreground'
                      : 'hover:text-foreground/80',
                  )}
                  aria-label={`${segmentLabel} ${option.number}`}
                >
                  {option.label}
                </button>
              ))}
              <span aria-hidden className="shrink-0" style={{ width: endSpacer }} />
            </div>
          </div>

          <button
            type="button"
            onClick={handlePickNext}
            disabled={activeOptionIndex < 0 || activeOptionIndex >= options.length - 1}
            className={cn(
              `
                inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
              `,
              activeOptionIndex >= 0 && activeOptionIndex < options.length - 1
                ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                : 'cursor-not-allowed opacity-40',
            )}
            aria-label={`Next ${segmentLabel.toLowerCase()}`}
          >
            <ChevronRightIcon className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function SportsEventQuerySync({
  onSelectionChange,
}: {
  onSelectionChange: (selection: SportsEventQuerySelection) => void
}) {
  const searchParams = useSearchParams()

  useEffect(() => {
    onSelectionChange({
      conditionId: searchParams.get('conditionId')?.trim() ?? null,
      outcomeIndex: parseRequestedOutcomeIndex(searchParams.get('outcomeIndex')),
    })
  }, [onSelectionChange, searchParams])

  return null
}

function resolvePositionShares(position: UserPosition) {
  const totalShares = typeof position.total_shares === 'number' ? position.total_shares : Number(position.size ?? 0)
  return Number.isFinite(totalShares) ? totalShares : 0
}

function resolveOutcomeIndexFromPosition(position: UserPosition) {
  if (position.outcome_index === OUTCOME_INDEX.YES || position.outcome_index === OUTCOME_INDEX.NO) {
    return position.outcome_index
  }

  const normalizedOutcome = position.outcome_text?.trim().toLowerCase()
  if (normalizedOutcome === 'no') {
    return OUTCOME_INDEX.NO
  }
  if (normalizedOutcome === 'yes') {
    return OUTCOME_INDEX.YES
  }
  return null
}

function resolveIndexSetFromOutcomeIndex(outcomeIndex: number | null | undefined) {
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 1
  }
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 2
  }
  return null
}

function resolveTeamShortLabel(team: SportsGamesCard['teams'][number] | null | undefined) {
  const abbreviation = team?.abbreviation?.trim()
  if (abbreviation) {
    return abbreviation.toUpperCase()
  }

  const name = team?.name?.trim()
  if (!name) {
    return '—'
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)

  return initials || name.slice(0, 3).toUpperCase()
}

const FULL_COMPETITOR_NAME_HERO_LABEL_SPORT_SLUGS = new Set([
  'boxing',
  'chess',
  'f1',
  'golf',
  'mma',
  'tennis',
  'ufc',
  'wtt-mens-singles',
  'zuffa',
])

function shouldUseFullCompetitorHeroLabels(sportSlug: string | null | undefined) {
  return FULL_COMPETITOR_NAME_HERO_LABEL_SPORT_SLUGS.has(
    normalizeComparableToken(sportSlug),
  )
}

function shouldUseFullScoreboardHeroLabels({
  sportSlug,
  vertical,
}: {
  sportSlug: string | null | undefined
  vertical: SportsVertical
}) {
  return vertical === 'esports' || shouldUseFullCompetitorHeroLabels(sportSlug)
}

function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return null
  }

  const team1 = Number.parseInt(match[1] ?? '', 10)
  const team2 = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
    return null
  }

  return { team1, team2 }
}

function resolveRelatedTeamOdds(card: SportsGamesCard) {
  const moneylineButtons = card.buttons.filter(button => button.marketType === 'moneyline')
  const team1Button = moneylineButtons.find(button => button.tone === 'team1') ?? moneylineButtons[0] ?? null
  const team2Button = moneylineButtons.find(button => button.tone === 'team2')
    ?? moneylineButtons.find(button => button.key !== team1Button?.key)
    ?? null

  return {
    team1Cents: team1Button?.cents ?? null,
    team2Cents: team2Button?.cents ?? null,
  }
}

function formatRelatedOddsLabel(cents: number | null) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return '—'
  }
  return `${cents}¢`
}

function normalizeComparableToken(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
    ?? ''
}

function tokenizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    ?? []
}

function doesTextMatchSportsTeam(
  value: string | null | undefined,
  team: SportsGamesCard['teams'][number] | null | undefined,
) {
  if (!value || !team) {
    return false
  }

  const normalizedValue = normalizeComparableToken(value)
  if (!normalizedValue) {
    return false
  }

  const normalizedTeamName = normalizeComparableToken(team.name)
  if (normalizedTeamName && normalizedValue.includes(normalizedTeamName)) {
    return true
  }

  const normalizedTeamAbbreviation = normalizeComparableToken(team.abbreviation)
  if (!normalizedTeamAbbreviation) {
    return false
  }

  return new Set(tokenizeComparableText(value)).has(normalizedTeamAbbreviation)
}

function resolveSegmentedEsportsButtonMarketType(
  market: SportsGamesCard['detailMarkets'][number],
): SportsGamesButton['marketType'] {
  const normalizedType = normalizeSportsMarketType(market.sports_market_type)

  if (isSegmentedEsportsChildMoneylineMarket(market) || isSegmentedEsportsPrimaryMoneylineMarket(market)) {
    return 'moneyline'
  }

  if (
    normalizedType === 'spread'
    || normalizedType === 'map_handicap'
    || normalizedType.includes('handicap')
  ) {
    return 'spread'
  }

  if (
    normalizedType === 'total'
    || normalizedType === 'totals'
    || normalizedType.includes('total')
  ) {
    return 'total'
  }

  if (
    normalizedType === 'btts'
    || normalizedType.includes('both_teams_to_score')
    || normalizedType.includes('both teams to score')
  ) {
    return 'btts'
  }

  return 'binary'
}

function buildSegmentedEsportsButtonsFromOutcomes(
  card: SportsGamesCard,
  market: SportsGamesCard['detailMarkets'][number],
) {
  const team1 = card.teams[0] ?? null
  const team2 = card.teams[1] ?? null
  const marketType = resolveSegmentedEsportsButtonMarketType(market)

  return [...market.outcomes]
    .sort((left, right) => left.outcome_index - right.outcome_index)
    .map((outcome) => {
      const outcomeText = outcome.outcome_text?.trim() ?? ''
      const normalizedOutcomeText = normalizeComparableToken(outcomeText)
      const matchedTeam = [team1, team2].find(team => doesTextMatchSportsTeam(outcomeText, team)) ?? null

      let label = outcomeText.toUpperCase() || 'MARKET'
      let color: string | null = null
      let tone: SportsGamesButton['tone'] = 'neutral'

      if (matchedTeam === team1) {
        label = resolveTeamShortLabel(team1)
        color = team1?.color ?? null
        tone = 'team1'
      }
      else if (matchedTeam === team2) {
        label = resolveTeamShortLabel(team2)
        color = team2?.color ?? null
        tone = 'team2'
      }
      else if (normalizedOutcomeText.includes('draw')) {
        label = 'DRAW'
        tone = 'draw'
      }
      else if (normalizedOutcomeText === 'yes') {
        label = 'YES'
        tone = 'over'
      }
      else if (normalizedOutcomeText === 'no') {
        label = 'NO'
        tone = 'under'
      }
      else if (normalizedOutcomeText === 'over') {
        label = 'OVER'
        tone = 'over'
      }
      else if (normalizedOutcomeText === 'under') {
        label = 'UNDER'
        tone = 'under'
      }

      const fallbackIsNoOutcome = normalizedOutcomeText === 'no'

      return {
        key: `${market.condition_id}:${outcome.outcome_index}`,
        conditionId: market.condition_id,
        outcomeIndex: outcome.outcome_index,
        fallbackIsNoOutcome,
        label,
        cents: resolveOutcomeSelectionPriceCents(market, outcome, {
          side: ORDER_SIDE.BUY,
          fallbackIsNoOutcome,
        }) ?? 50,
        color,
        marketType,
        tone,
      } satisfies SportsGamesButton
    })
}

function shouldNormalizeSegmentedEsportsMarketButtons(
  market: SportsGamesCard['detailMarkets'][number],
  currentButtons: SportsGamesButton[],
) {
  if (parseEsportsSegmentNumber(market) == null || market.outcomes.length <= 1) {
    return false
  }

  if (currentButtons.length !== market.outcomes.length) {
    return true
  }

  const expectedMarketType = resolveSegmentedEsportsButtonMarketType(market)
  if (currentButtons.some(button => button.marketType !== expectedMarketType)) {
    return true
  }

  const currentOutcomeIndexes = new Set(currentButtons.map(button => button.outcomeIndex))
  return market.outcomes.some(outcome => !currentOutcomeIndexes.has(outcome.outcome_index))
}

function resolveNormalizedSegmentedEsportsCard(
  card: SportsGamesCard,
  vertical: SportsVertical,
) {
  if (!isSegmentedEsportsEventCard(card, vertical)) {
    return card
  }

  const buttonsByConditionId = new Map<string, SportsGamesButton[]>()
  card.buttons.forEach((button) => {
    const currentButtons = buttonsByConditionId.get(button.conditionId)
    if (currentButtons) {
      currentButtons.push(button)
      return
    }

    buttonsByConditionId.set(button.conditionId, [button])
  })

  const rebuiltButtonsByConditionId = new Map<string, SportsGamesButton[]>()
  card.detailMarkets.forEach((market) => {
    const currentButtons = buttonsByConditionId.get(market.condition_id) ?? []
    if (!shouldNormalizeSegmentedEsportsMarketButtons(market, currentButtons)) {
      return
    }

    const rebuiltButtons = buildSegmentedEsportsButtonsFromOutcomes(card, market)
    if (rebuiltButtons.length > 0) {
      rebuiltButtonsByConditionId.set(market.condition_id, rebuiltButtons)
    }
  })

  if (rebuiltButtonsByConditionId.size === 0) {
    return card
  }

  const nextButtons: SportsGamesButton[] = []
  const insertedConditionIds = new Set<string>()

  card.buttons.forEach((button) => {
    const rebuiltButtons = rebuiltButtonsByConditionId.get(button.conditionId)
    if (rebuiltButtons) {
      if (!insertedConditionIds.has(button.conditionId)) {
        nextButtons.push(...rebuiltButtons)
        insertedConditionIds.add(button.conditionId)
      }
      return
    }

    nextButtons.push(button)
  })

  card.detailMarkets.forEach((market) => {
    if (insertedConditionIds.has(market.condition_id)) {
      return
    }

    const rebuiltButtons = rebuiltButtonsByConditionId.get(market.condition_id)
    if (!rebuiltButtons) {
      return
    }

    nextButtons.push(...rebuiltButtons)
    insertedConditionIds.add(market.condition_id)
  })

  return {
    ...card,
    buttons: nextButtons,
  }
}

function resolveTeamByTone(card: SportsGamesCard, tone: SportsGamesButton['tone']) {
  if (tone === 'team1') {
    return card.teams[0] ?? null
  }
  if (tone === 'team2') {
    return card.teams[1] ?? null
  }
  return null
}

function resolveRedeemOptionLabel(
  card: SportsGamesCard,
  market: SportsGamesCard['detailMarkets'][number],
  button: SportsGamesButton,
) {
  const rawLabel = button.label?.trim() ?? ''
  const team = resolveTeamByTone(card, button.tone)

  if (team?.name) {
    const firstToken = rawLabel.split(/\s+/)[0] ?? ''
    const normalizedFirstToken = normalizeComparableToken(firstToken)
    const normalizedTeamAbbreviation = normalizeComparableToken(team.abbreviation)
    const normalizedTeamName = normalizeComparableToken(team.name)

    if (normalizedFirstToken && (
      (normalizedTeamAbbreviation && normalizedFirstToken === normalizedTeamAbbreviation)
      || (normalizedTeamName && normalizedTeamName.startsWith(normalizedFirstToken))
    )) {
      return `${team.name}${rawLabel.slice(firstToken.length)}`
    }

    return team.name
  }

  if (button.tone === 'draw') {
    return 'Draw'
  }

  if (button.tone === 'over') {
    return rawLabel || 'Over'
  }

  if (button.tone === 'under') {
    return rawLabel || 'Under'
  }

  return market.sports_group_item_title?.trim()
    || market.short_title?.trim()
    || market.title
    || rawLabel
}

function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return null
  }

  let normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (!normalized.startsWith('#')) {
    normalized = `#${normalized}`
  }

  if (/^#[0-9A-F]{3}$/i.test(normalized) || /^#[0-9A-F]{6}$/i.test(normalized)) {
    return normalized
  }

  return null
}

function resolveHexToRgbComponents(value: string) {
  const hex = value.replace('#', '')
  const expandedHex = hex.length === 3
    ? hex.split('').map(char => `${char}${char}`).join('')
    : hex

  const red = Number.parseInt(expandedHex.slice(0, 2), 16)
  const green = Number.parseInt(expandedHex.slice(2, 4), 16)
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16)
  if ([red, green, blue].some(component => Number.isNaN(component))) {
    return null
  }

  return `${red} ${green} ${blue}`
}

function resolveRedeemTagAccent(
  button: SportsGamesButton | null,
  outcomeIndex: number | null,
) {
  const normalizedTeamColor = normalizeHexColor(button?.color)
  if (
    button
    && (button.tone === 'team1' || button.tone === 'team2')
    && normalizedTeamColor
  ) {
    const rgbComponents = resolveHexToRgbComponents(normalizedTeamColor)
    const readableTeamColor = ensureReadableTextColorOnDark(normalizedTeamColor)
    return {
      badgeClassName: '',
      badgeStyle: {
        color: readableTeamColor ?? normalizedTeamColor,
        backgroundColor: rgbComponents ? `rgb(${rgbComponents} / 0.10)` : undefined,
      } as const,
    }
  }

  if ((button && button.tone === 'over') || outcomeIndex === OUTCOME_INDEX.YES) {
    return {
      badgeClassName: 'bg-yes/10 text-yes',
      badgeStyle: undefined,
    }
  }

  if ((button && button.tone === 'under') || outcomeIndex === OUTCOME_INDEX.NO) {
    return {
      badgeClassName: 'bg-no/10 text-no',
      badgeStyle: undefined,
    }
  }

  return {
    badgeClassName: 'bg-muted/60 text-muted-foreground',
    badgeStyle: undefined,
  }
}

function SportsEventShareButton({ event }: { event: SportsGamesCard['event'] }) {
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''
  const [shareSuccess, setShareSuccess] = useState(false)
  const debugPayload = useMemo(() => {
    return {
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
      },
      markets: (event.markets ?? []).map(market => ({
        slug: market.slug,
        condition_id: market.condition_id,
        question_id: market.question_id,
        metadata_hash: market.condition?.metadata_hash ?? null,
        short_title: market.short_title ?? null,
        title: market.title,
        outcomes: market.outcomes.map(outcome => ({
          outcome_index: outcome.outcome_index,
          outcome_text: outcome.outcome_text,
          token_id: outcome.token_id,
        })),
      })),
    }
  }, [event.id, event.markets, event.slug, event.title])

  const handleDebugCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2))
    }
    catch {
      // noop
    }
  }, [debugPayload])

  const maybeHandleDebugCopy = useCallback((event: React.MouseEvent) => {
    if (!event.altKey) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    void handleDebugCopy()
    return true
  }, [handleDebugCopy])

  async function handleShare() {
    try {
      const url = new URL(window.location.href)
      if (affiliateCode) {
        url.searchParams.set('r', affiliateCode)
      }
      await navigator.clipboard.writeText(url.toString())
      setShareSuccess(true)
      window.setTimeout(setShareSuccess, 2000, false)
    }
    catch {
      // noop
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(headerIconButtonClass, 'size-auto p-0')}
      aria-label="Copy event link"
      onClick={(event) => {
        if (maybeHandleDebugCopy(event)) {
          return
        }
        void handleShare()
      }}
    >
      {shareSuccess
        ? <CheckIcon className="size-4 text-primary" />
        : <ShareIcon className="size-4" />}
    </Button>
  )
}

function normalizeLivestreamUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  }
  catch {
    return null
  }
}

function SportsEventLiveStatusIcon({ className, muted = false }: { className?: string, muted?: boolean }) {
  if (muted) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        className={cn(className, 'text-muted-foreground')}
        fill="none"
      >
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
          <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" />
          <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" />
          <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
          <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" />
          <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-red-500')}
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
        <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  )
}

function sortSectionButtons(sectionKey: EventSectionKey, buttons: SportsGamesButton[]) {
  if (sectionKey === 'spread') {
    const order: Record<SportsGamesButton['tone'], number> = {
      team1: 0,
      team2: 1,
      draw: 2,
      over: 3,
      under: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  if (sectionKey === 'total' || sectionKey === 'btts') {
    const order: Record<SportsGamesButton['tone'], number> = {
      over: 0,
      under: 1,
      team1: 2,
      team2: 3,
      draw: 4,
      neutral: 5,
    }

    return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
  }

  return buttons
}

function sortAuxiliaryButtons(buttons: SportsGamesButton[]) {
  const order: Record<SportsGamesButton['tone'], number> = {
    team1: 0,
    draw: 1,
    team2: 2,
    over: 3,
    under: 4,
    neutral: 5,
  }

  return [...buttons].sort((a, b) => (order[a.tone] ?? 99) - (order[b.tone] ?? 99))
}

function isEventSectionKey(value: SportsGamesButton['marketType']): value is EventSectionKey {
  return value === 'moneyline' || value === 'spread' || value === 'total' || value === 'btts'
}

function resolveEventSectionKeyForButton(
  button: SportsGamesButton | null | undefined,
  market: SportsGamesCard['detailMarkets'][number] | null | undefined,
): EventSectionKey | null {
  if (market) {
    if (isSegmentedEsportsChildMoneylineMarket(market) || isSegmentedEsportsBinaryMarket(market)) {
      return null
    }

    const normalizedType = normalizeSportsMarketType(market.sports_market_type)
    if (isSegmentedEsportsPrimaryMoneylineMarket(market) || normalizedType === 'moneyline') {
      return 'moneyline'
    }

    if (
      normalizedType === 'spread'
      || normalizedType === 'map_handicap'
      || normalizedType.includes('handicap')
    ) {
      return 'spread'
    }

    if (
      normalizedType === 'total'
      || normalizedType === 'totals'
      || normalizedType.includes('total')
    ) {
      return 'total'
    }

    if (
      normalizedType === 'btts'
      || normalizedType.includes('both_teams_to_score')
      || normalizedType.includes('both teams to score')
    ) {
      return 'btts'
    }
  }

  if (!button) {
    return null
  }

  if (button.marketType === 'binary') {
    return 'moneyline'
  }

  return isEventSectionKey(button.marketType) ? button.marketType : null
}

function resolveMarketViewCardBySlug(
  marketViewCards: SportsGamesCardMarketView[],
  marketSlug: string | null,
) {
  if (!marketSlug) {
    return null
  }

  return marketViewCards.find(view =>
    view.card.detailMarkets.some(market => market.slug === marketSlug),
  ) ?? null
}

function dedupeAuxiliaryButtons(buttons: SportsGamesButton[]) {
  const byKey = new Map<string, SportsGamesButton>()
  buttons.forEach((button) => {
    byKey.set(button.key, button)
  })
  return Array.from(byKey.values())
}

function resolveAuxiliaryPanelCreatedAt(markets: SportsGamesCard['detailMarkets']) {
  return markets.reduce<number>((earliestTimestamp, market) => {
    const timestamp = Date.parse(market.created_at)
    if (!Number.isFinite(timestamp)) {
      return earliestTimestamp
    }

    return Math.min(earliestTimestamp, timestamp)
  }, Number.POSITIVE_INFINITY)
}

function resolveAuxiliaryPanelThreshold(markets: SportsGamesCard['detailMarkets']) {
  return markets.reduce<number>((lowestThreshold, market) => {
    const threshold = Number(market.sports_group_item_threshold)
    if (!Number.isFinite(threshold)) {
      return lowestThreshold
    }

    return Math.min(lowestThreshold, threshold)
  }, Number.POSITIVE_INFINITY)
}

function SportsEventRelatedGames({
  cards,
  sportSlug,
  sportLabel,
  locale,
  vertical,
}: {
  cards: SportsGamesCard[]
  sportSlug: string
  sportLabel: string
  locale: string
  vertical: SportsVertical
}) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    [locale],
  )

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2.5">
      <p className="text-sm font-normal text-muted-foreground">
        {'More '}
        <AppLink href={`${verticalConfig.basePath}/${sportSlug}/games`} className="underline-offset-2 hover:underline">
          {sportLabel}
        </AppLink>
        {' Games'}
      </p>

      <div className="grid gap-2">
        {cards.map((relatedCard) => {
          const startTime = relatedCard.startTime ? new Date(relatedCard.startTime) : null
          const hasValidStartTime = Boolean(startTime && !Number.isNaN(startTime.getTime()))
          const topLineDate = hasValidStartTime ? dateTimeFormatter.format(startTime as Date) : 'Date TBD'
          const { team1Cents, team2Cents } = resolveRelatedTeamOdds(relatedCard)
          const team1 = relatedCard.teams[0] ?? null
          const team2 = relatedCard.teams[1] ?? null

          return (
            <AppLink
              intentPrefetch
              key={relatedCard.id}
              href={relatedCard.eventHref}
              className={cn(`block rounded-xl px-3 py-2.5 transition-colors hover:bg-card`)}
            >
              <p className="mb-2 text-xs font-normal text-muted-foreground">
                {topLineDate}
                <span className="mx-2 inline-block">·</span>
                {formatVolume(relatedCard.volume)}
                {' '}
                Vol.
              </p>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      {team1?.logoUrl
                        ? (
                            <Image
                              src={team1.logoUrl}
                              alt={`${team1.name} logo`}
                              width={24}
                              height={24}
                              sizes="24px"
                              className="size-full object-contain object-center"
                            />
                          )
                        : (
                            <span className="text-2xs font-semibold text-muted-foreground">
                              {team1?.abbreviation?.slice(0, 1)?.toUpperCase() ?? '—'}
                            </span>
                          )}
                    </span>
                    <span className="truncate text-xs font-normal text-foreground">
                      {team1?.name ?? '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-normal text-muted-foreground">
                    {formatRelatedOddsLabel(team1Cents)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      {team2?.logoUrl
                        ? (
                            <Image
                              src={team2.logoUrl}
                              alt={`${team2.name} logo`}
                              width={24}
                              height={24}
                              sizes="24px"
                              className="size-full object-contain object-center"
                            />
                          )
                        : (
                            <span className="text-2xs font-semibold text-muted-foreground">
                              {team2?.abbreviation?.slice(0, 1)?.toUpperCase() ?? '—'}
                            </span>
                          )}
                    </span>
                    <span className="truncate text-xs font-normal text-foreground">
                      {team2?.name ?? '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-normal text-muted-foreground">
                    {formatRelatedOddsLabel(team2Cents)}
                  </span>
                </div>
              </div>
            </AppLink>
          )
        })}
      </div>
    </div>
  )
}

export default function SportsEventCenter({
  card,
  marketViewCards = [],
  relatedCards = [],
  marketContextEnabled = false,
  sportSlug,
  sportLabel,
  initialMarketSlug = null,
  initialMarketViewKey = null,
  vertical = 'sports',
}: SportsEventCenterProps) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const locale = useLocale()
  const site = useSiteIdentity()
  const isMobile = useIsMobile()
  const setOrderEvent = useOrder(state => state.setEvent)
  const setOrderMarket = useOrder(state => state.setMarket)
  const setOrderOutcome = useOrder(state => state.setOutcome)
  const setOrderSide = useOrder(state => state.setSide)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const openLivestream = useSportsLivestream(state => state.openStream)
  const activeStreamUrl = useSportsLivestream(state => state.streamUrl)
  const orderEventId = useOrder(state => state.event?.id ?? null)
  const orderMarketConditionId = useOrder(state => state.market?.condition_id ?? null)
  const orderOutcomeIndex = useOrder(state => state.outcome?.outcome_index ?? null)
  const user = useUser()
  const [querySelection, setQuerySelection] = useState<SportsEventQuerySelection>(EMPTY_QUERY_SELECTION)
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('price')
  const [hasLoadedOddsFormat, setHasLoadedOddsFormat] = useState(false)
  const [claimedConditionIds, setClaimedConditionIds] = useState<Record<string, true>>({})
  const [redeemSectionKey, setRedeemSectionKey] = useState<EventSectionKey | null>(null)
  const [redeemDefaultConditionId, setRedeemDefaultConditionId] = useState<string | null>(null)
  const normalizedMarketViewCards = useMemo(
    () => marketViewCards.length > 0
      ? marketViewCards
      : [{ key: 'gameLines' as const, label: 'Game Lines', card }],
    [card, marketViewCards],
  )
  const initialMarketViewFromSlug = useMemo(
    () => resolveMarketViewCardBySlug(normalizedMarketViewCards, initialMarketSlug)?.key ?? null,
    [initialMarketSlug, normalizedMarketViewCards],
  )
  const resolvedInitialMarketViewKey = useMemo(() => {
    if (
      initialMarketViewFromSlug
      && normalizedMarketViewCards.some(view => view.key === initialMarketViewFromSlug)
    ) {
      return initialMarketViewFromSlug
    }

    if (
      initialMarketViewKey
      && normalizedMarketViewCards.some(view => view.key === initialMarketViewKey)
    ) {
      return initialMarketViewKey
    }

    return normalizedMarketViewCards.find(view => view.key === 'gameLines')?.key
      ?? normalizedMarketViewCards[0]?.key
      ?? 'gameLines'
  }, [initialMarketViewFromSlug, initialMarketViewKey, normalizedMarketViewCards])
  const [activeMarketViewKey, setActiveMarketViewKey] = useState<SportsEventMarketViewKey>(resolvedInitialMarketViewKey)

  const handleQuerySelectionChange = useCallback((nextSelection: SportsEventQuerySelection) => {
    setQuerySelection((current) => {
      if (
        current.conditionId === nextSelection.conditionId
        && current.outcomeIndex === nextSelection.outcomeIndex
      ) {
        return current
      }

      return nextSelection
    })
  }, [])

  const ownerAddress = useMemo(() => {
    if (user?.proxy_wallet_address && user.proxy_wallet_status === 'deployed') {
      return user.proxy_wallet_address
    }
    return null
  }, [user?.proxy_wallet_address, user?.proxy_wallet_status])

  useEffect(() => {
    setActiveMarketViewKey(resolvedInitialMarketViewKey)
  }, [resolvedInitialMarketViewKey])

  const activeMarketView = useMemo(
    () => normalizedMarketViewCards.find(view => view.key === activeMarketViewKey)
      ?? normalizedMarketViewCards.find(view => view.key === resolvedInitialMarketViewKey)
      ?? normalizedMarketViewCards[0]
      ?? null,
    [activeMarketViewKey, normalizedMarketViewCards, resolvedInitialMarketViewKey],
  )
  const heroCard = card
  const activeSourceCard = activeMarketView?.card ?? card
  const activeCard = useMemo(
    () => resolveNormalizedSegmentedEsportsCard(activeSourceCard, vertical),
    [activeSourceCard, vertical],
  )
  const hasMultipleMarketViews = normalizedMarketViewCards.length > 1
  const isGameLinesView = (activeMarketView?.key ?? 'gameLines') === 'gameLines'
  const isHalftimeResultView = activeMarketView?.key === 'halftimeResult'
  const baseUsesSectionLayout = isGameLinesView || isHalftimeResultView
  const heroGroupedButtons = useMemo(() => groupButtonsByMarketType(heroCard.buttons), [heroCard.buttons])
  const detailMarketByConditionId = useMemo(
    () => new Map(activeCard.detailMarkets.map(market => [market.condition_id, market] as const)),
    [activeCard.detailMarkets],
  )
  const activeCardButtonTokenIds = useMemo(() => {
    const tokenIds = new Set<string>()

    activeCard.buttons.forEach((button) => {
      const market = detailMarketByConditionId.get(button.conditionId)
      const outcome = market?.outcomes.find(currentOutcome => currentOutcome.outcome_index === button.outcomeIndex)
        ?? market?.outcomes[button.outcomeIndex]

      if (outcome?.token_id) {
        tokenIds.add(String(outcome.token_id))
      }
    })

    return Array.from(tokenIds)
  }, [activeCard.buttons, detailMarketByConditionId])
  const { data: buttonOrderBookSummaries } = useOrderBookSummaries(activeCardButtonTokenIds)
  const buttonPriceCentsByKey = useMemo(() => {
    const priceByKey = new Map<string, number>()

    activeCard.buttons.forEach((button) => {
      const market = detailMarketByConditionId.get(button.conditionId) ?? null
      const outcome = market?.outcomes.find(currentOutcome => currentOutcome.outcome_index === button.outcomeIndex)
        ?? market?.outcomes[button.outcomeIndex]
      const cents = resolveOutcomePriceCents(
        market,
        button.outcomeIndex === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES,
        {
          orderBookSummaries: buttonOrderBookSummaries,
          side: ORDER_SIDE.BUY,
        },
      )
      const selectionCents = resolveOutcomeSelectionPriceCents(market, outcome, {
        orderBookSummaries: buttonOrderBookSummaries,
        side: ORDER_SIDE.BUY,
        fallbackIsNoOutcome: button.fallbackIsNoOutcome,
      })
      priceByKey.set(button.key, selectionCents ?? cents ?? button.cents)
    })

    return priceByKey
  }, [activeCard.buttons, buttonOrderBookSummaries, detailMarketByConditionId])
  const { singular: segmentLabel, plural: segmentPluralLabel } = useMemo(
    () => resolveEsportsSegmentLabels(activeCard),
    [activeCard],
  )
  const esportsSegmentTabNumbers = useMemo(() => {
    const numbers = new Set<number>()

    activeCard.detailMarkets.forEach((market) => {
      const mapNumber = parseEsportsSegmentNumber(market)
      if (mapNumber != null) {
        numbers.add(mapNumber)
      }
    })

    return Array.from(numbers).sort((left, right) => left - right)
  }, [activeCard.detailMarkets])
  const hasEsportsSegmentedLayout = useMemo(
    () => baseUsesSectionLayout && isSegmentedEsportsEventCard(activeCard, vertical) && esportsSegmentTabNumbers.length > 0,
    [activeCard, baseUsesSectionLayout, esportsSegmentTabNumbers.length, vertical],
  )
  const initialEsportsSegmentTabKey = useMemo<EsportsLayoutTabKey>(() => {
    if (!hasEsportsSegmentedLayout || !initialMarketSlug) {
      return 'series'
    }

    const matchedMarket = activeCard.detailMarkets.find(market => market.slug === initialMarketSlug) ?? null
    const mapNumber = parseEsportsSegmentNumber(matchedMarket)
    if (mapNumber == null) {
      return 'series'
    }

    return esportsSegmentTabNumbers.includes(mapNumber)
      ? resolveEsportsSegmentTabKey(mapNumber)
      : 'series'
  }, [activeCard.detailMarkets, esportsSegmentTabNumbers, hasEsportsSegmentedLayout, initialMarketSlug])
  const [activeEsportsSegmentTabKey, setActiveEsportsSegmentTabKey] = useState<EsportsLayoutTabKey>(initialEsportsSegmentTabKey)
  const activeEsportsSegmentNumber = useMemo(
    () => parseEsportsSegmentTabNumber(activeEsportsSegmentTabKey),
    [activeEsportsSegmentTabKey],
  )
  const [activeSeriesPreviewSegmentNumber, setActiveSeriesPreviewSegmentNumber] = useState<number | null>(
    esportsSegmentTabNumbers[0] ?? null,
  )
  const [activeSeriesSpreadPickerNumber, setActiveSeriesSpreadPickerNumber] = useState<number | null>(
    esportsSegmentTabNumbers[0] ?? null,
  )
  const usesSectionLayout = baseUsesSectionLayout && (!hasEsportsSegmentedLayout || activeEsportsSegmentTabKey === 'series')

  useEffect(() => {
    setActiveEsportsSegmentTabKey(initialEsportsSegmentTabKey)
  }, [initialEsportsSegmentTabKey])

  useEffect(() => {
    setActiveSeriesPreviewSegmentNumber(current => (
      current != null && esportsSegmentTabNumbers.includes(current)
        ? current
        : (esportsSegmentTabNumbers[0] ?? null)
    ))
  }, [esportsSegmentTabNumbers])

  useEffect(() => {
    setActiveSeriesSpreadPickerNumber(current => (
      current != null && esportsSegmentTabNumbers.includes(current)
        ? current
        : (esportsSegmentTabNumbers[0] ?? null)
    ))
  }, [esportsSegmentTabNumbers])

  const { data: userPositions } = useQuery<UserPosition[]>({
    queryKey: ['sports-event-user-positions', ownerAddress, activeCard.id],
    enabled: Boolean(ownerAddress),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchInterval: ownerAddress ? 15_000 : false,
    refetchIntervalInBackground: true,
    queryFn: ({ signal }) => fetchUserPositionsForMarket({
      pageParam: 0,
      userAddress: ownerAddress!,
      status: 'active',
      signal,
    }),
  })

  useEffect(() => {
    setClaimedConditionIds({})
    setRedeemSectionKey(null)
    setRedeemDefaultConditionId(null)
  }, [activeCard.id])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedOddsFormat = window.localStorage.getItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY)
    const matchedOption = ODDS_FORMAT_OPTIONS.find(option => option.value === storedOddsFormat)
    if (matchedOption) {
      setOddsFormat(matchedOption.value)
    }
    setHasLoadedOddsFormat(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedOddsFormat || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY, oddsFormat)
  }, [hasLoadedOddsFormat, oddsFormat])

  const formatButtonOdds = useCallback((cents: number) => {
    if (oddsFormat === 'price') {
      return `${cents}¢`
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])

  const groupedButtons = useMemo(() => {
    if (!hasEsportsSegmentedLayout) {
      return groupButtonsByMarketType(activeCard.buttons)
    }

    const grouped: Record<SportsGamesMarketType, SportsGamesButton[]> = {
      moneyline: [],
      spread: [],
      total: [],
      btts: [],
      binary: [],
    }

    activeCard.buttons.forEach((button) => {
      const market = detailMarketByConditionId.get(button.conditionId)
      if (!market) {
        return
      }

      const sectionKey = resolveEventSectionKeyForButton(button, market)
      if (!sectionKey) {
        return
      }

      grouped[sectionKey].push(button)
    })

    return grouped
  }, [activeCard.buttons, detailMarketByConditionId, hasEsportsSegmentedLayout])
  const buttonByConditionAndOutcome = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    activeCard.buttons.forEach((button) => {
      map.set(`${button.conditionId}:${button.outcomeIndex}`, button)
    })
    return map
  }, [activeCard.buttons])
  const firstButtonByConditionId = useMemo(() => {
    const map = new Map<string, SportsGamesButton>()
    activeCard.buttons.forEach((button) => {
      if (!map.has(button.conditionId)) {
        map.set(button.conditionId, button)
      }
    })
    return map
  }, [activeCard.buttons])
  const availableSections = useMemo(
    () => SECTION_ORDER.filter(section => groupedButtons[section.key].length > 0),
    [groupedButtons],
  )
  const sectionResolvedByKey = useMemo<Record<EventSectionKey, boolean>>(() => {
    const resolved: Record<EventSectionKey, boolean> = {
      moneyline: false,
      spread: false,
      total: false,
      btts: false,
    }

    SECTION_ORDER.forEach((section) => {
      const conditionIds = Array.from(new Set(groupedButtons[section.key].map(button => button.conditionId)))
      if (conditionIds.length === 0) {
        return
      }

      resolved[section.key] = conditionIds.every((conditionId) => {
        const market = detailMarketByConditionId.get(conditionId)
        return Boolean(market?.is_resolved || market?.condition?.resolved)
      })
    })

    return resolved
  }, [detailMarketByConditionId, groupedButtons])

  const claimGroupsBySection = useMemo<Record<EventSectionKey, SportsRedeemModalGroup[]>>(() => {
    const bySection: Record<EventSectionKey, SportsRedeemModalGroup[]> = {
      moneyline: [],
      spread: [],
      total: [],
      btts: [],
    }

    if (!userPositions?.length) {
      return bySection
    }

    const bySectionCondition = new Map<string, {
      sectionKey: EventSectionKey
      group: SportsRedeemModalGroup & { _indexSetCollection: Set<number> }
    }>()

    userPositions.forEach((position) => {
      if (!position.redeemable) {
        return
      }

      const conditionId = position.market?.condition_id
      if (!conditionId || claimedConditionIds[conditionId]) {
        return
      }

      const market = detailMarketByConditionId.get(conditionId)
      const firstButton = firstButtonByConditionId.get(conditionId)
      if (!market || !firstButton) {
        return
      }

      const sectionKey = resolveEventSectionKeyForButton(firstButton, market)
      if (!sectionKey) {
        return
      }

      const shares = resolvePositionShares(position)
      if (!(shares > 0)) {
        return
      }

      const key = `${sectionKey}:${conditionId}`
      let bucket = bySectionCondition.get(key)
      if (!bucket) {
        bucket = {
          sectionKey,
          group: {
            conditionId,
            title: resolveRedeemOptionLabel(activeCard, market, firstButton),
            amount: 0,
            indexSets: [],
            isNegRisk: Boolean(market.neg_risk),
            yesShares: 0,
            noShares: 0,
            positions: [],
            _indexSetCollection: new Set<number>(),
          },
        }
        bySectionCondition.set(key, bucket)
      }
      else if (market.neg_risk) {
        bucket.group.isNegRisk = true
      }

      const outcomeIndex = resolveOutcomeIndexFromPosition(position)
      const indexSet = resolveIndexSetFromOutcomeIndex(outcomeIndex)
      if (indexSet) {
        bucket.group._indexSetCollection.add(indexSet)
      }

      const positionButton = (outcomeIndex === OUTCOME_INDEX.YES || outcomeIndex === OUTCOME_INDEX.NO)
        ? (buttonByConditionAndOutcome.get(`${conditionId}:${outcomeIndex}`) ?? firstButton)
        : firstButton
      const outcomeLabel = (outcomeIndex === OUTCOME_INDEX.YES || outcomeIndex === OUTCOME_INDEX.NO)
        ? (market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)?.outcome_text
          ?? position.outcome_text
          ?? `Outcome ${outcomeIndex + 1}`)
        : (position.outcome_text || 'Outcome')
      const preferredButton = [positionButton, firstButton].find((button) => {
        const normalizedLabel = button.label?.trim().toLowerCase()
        return Boolean(normalizedLabel) && normalizedLabel !== 'yes' && normalizedLabel !== 'no'
      })
      const preferredButtonLabel = preferredButton
        ? resolveRedeemOptionLabel(activeCard, market, preferredButton)
        : null
      const fallbackButtonLabel = [positionButton.label?.trim(), firstButton.label?.trim()].find((label) => {
        const normalizedLabel = label?.toLowerCase()
        return Boolean(label) && normalizedLabel !== 'yes' && normalizedLabel !== 'no'
      })
      const positionOptionLabel = preferredButtonLabel
        || fallbackButtonLabel
        || market.sports_group_item_title?.trim()
        || market.short_title?.trim()
        || market.title
      const outcomeSideLabel = outcomeIndex === OUTCOME_INDEX.NO
        ? 'No'
        : outcomeIndex === OUTCOME_INDEX.YES
          ? 'Yes'
          : null
      const positionLabel = outcomeSideLabel
        ? `${positionOptionLabel || outcomeLabel} - ${outcomeSideLabel}`
        : outcomeLabel
      const tagAccent = resolveRedeemTagAccent(positionButton, outcomeIndex)

      bucket.group.positions.push({
        key: `${conditionId}-${outcomeLabel}-${bucket.group.positions.length}`,
        label: positionLabel,
        shares,
        value: shares,
        outcomeIndex,
        badgeClassName: tagAccent.badgeClassName,
        badgeStyle: tagAccent.badgeStyle,
      })

      if (bucket.group.isNegRisk) {
        if (outcomeIndex === OUTCOME_INDEX.YES) {
          bucket.group.yesShares = (bucket.group.yesShares ?? 0) + shares
        }
        else if (outcomeIndex === OUTCOME_INDEX.NO) {
          bucket.group.noShares = (bucket.group.noShares ?? 0) + shares
        }
      }

      bucket.group.amount += shares
    })

    bySectionCondition.forEach(({ sectionKey, group }) => {
      if (group._indexSetCollection.size === 0) {
        const market = detailMarketByConditionId.get(group.conditionId)
        const winningOutcome = market?.outcomes.find(outcome => outcome.is_winning_outcome)
        const fallbackIndexSet = resolveIndexSetFromOutcomeIndex(winningOutcome?.outcome_index)
        if (fallbackIndexSet) {
          group._indexSetCollection.add(fallbackIndexSet)
        }
      }

      if (group._indexSetCollection.size === 0 || !(group.amount > 0)) {
        return
      }

      bySection[sectionKey].push({
        conditionId: group.conditionId,
        title: group.title,
        amount: group.amount,
        indexSets: Array.from(group._indexSetCollection).sort((a, b) => a - b),
        isNegRisk: group.isNegRisk,
        yesShares: group.yesShares,
        noShares: group.noShares,
        positions: group.positions,
      })
    })

    SECTION_ORDER.forEach((section) => {
      bySection[section.key].sort((left, right) => right.amount - left.amount)
    })

    return bySection
  }, [activeCard, buttonByConditionAndOutcome, claimedConditionIds, detailMarketByConditionId, firstButtonByConditionId, userPositions])

  const marketSlugToButtonKey = useMemo(() => {
    const requestedConditionId = querySelection.conditionId
    const requestedOutcomeIndex = querySelection.outcomeIndex

    function resolveButtonKeyForConditionId(conditionId: string) {
      if (requestedOutcomeIndex !== null) {
        const exactMatch = activeCard.buttons.find(button =>
          button.conditionId === conditionId && button.outcomeIndex === requestedOutcomeIndex,
        )
        if (exactMatch) {
          return exactMatch.key
        }
      }

      return activeCard.buttons.find(button => button.conditionId === conditionId)?.key ?? null
    }

    if (requestedConditionId) {
      return resolveButtonKeyForConditionId(requestedConditionId)
    }

    if (!initialMarketSlug) {
      return null
    }

    const matchedMarket = activeCard.detailMarkets.find(market => market.slug === initialMarketSlug)
    if (!matchedMarket) {
      return null
    }

    return resolveButtonKeyForConditionId(matchedMarket.condition_id)
  }, [
    activeCard.buttons,
    activeCard.detailMarkets,
    initialMarketSlug,
    querySelection.conditionId,
    querySelection.outcomeIndex,
  ])

  const [selectedButtonBySection, setSelectedButtonBySection] = useState<Record<EventSectionKey, string | null>>({
    moneyline: null,
    spread: null,
    total: null,
    btts: null,
  })
  const [selectedAuxiliaryButtonByConditionId, setSelectedAuxiliaryButtonByConditionId] = useState<
    Record<string, string | null>
  >({})
  const [activeTradeButtonKey, setActiveTradeButtonKey] = useState<string | null>(null)
  const [openSectionKey, setOpenSectionKey] = useState<EventSectionKey | null>(null)
  const [openAuxiliaryConditionId, setOpenAuxiliaryConditionId] = useState<string | null>(null)
  const [tabBySection, setTabBySection] = useState<Record<EventSectionKey, DetailsTab>>({
    moneyline: 'orderBook',
    spread: 'orderBook',
    total: 'orderBook',
    btts: 'orderBook',
  })
  const [tabByAuxiliaryConditionId, setTabByAuxiliaryConditionId] = useState<Record<string, DetailsTab>>({})
  const previousCardIdRef = useRef<string | null>(null)
  const appliedMarketSlugSelectionRef = useRef<string | null>(null)
  const pushedOrderSelectionRef = useRef<string | null>(null)
  const currentOrderSelectionRef = useRef<{
    eventId: string | null
    conditionId: string | null
    outcomeIndex: number | null
  }>({
    eventId: null,
    conditionId: null,
    outcomeIndex: null,
  })
  const auxiliaryMarketCards = useMemo<AuxiliaryMarketPanel[]>(() => {
    const buttonsByConditionId = new Map<string, SportsGamesButton[]>()

    activeCard.buttons.forEach((button) => {
      const currentButtons = buttonsByConditionId.get(button.conditionId) ?? []
      currentButtons.push(button)
      buttonsByConditionId.set(button.conditionId, currentButtons)
    })

    const panelsByKey = new Map<string, AuxiliaryMarketPanel>()

    activeCard.detailMarkets.forEach((market) => {
      const buttons = sortAuxiliaryButtons(buttonsByConditionId.get(market.condition_id) ?? [])

      if (buttons.length === 0) {
        return
      }

      const isSegmentedEsportsMarket = hasEsportsSegmentedLayout && parseEsportsSegmentNumber(market) != null

      if (baseUsesSectionLayout && buttons[0]?.marketType !== 'binary' && !isSegmentedEsportsMarket) {
        return
      }

      const mapNumber = hasEsportsSegmentedLayout && isSegmentedEsportsMarket
        ? parseEsportsSegmentNumber(market)
        : null
      const panelKey = mapNumber != null
        ? `${activeCard.id}:${normalizeSportsMarketType(market.sports_market_type)}:map-${mapNumber}`
        : resolveSportsAuxiliaryMarketGroupKey(market)
      const existingPanel = panelsByKey.get(panelKey)
      if (existingPanel) {
        existingPanel.markets.push(market)
        existingPanel.buttons.push(...buttons)
        existingPanel.volume += Number(market.volume ?? 0)
        return
      }

      panelsByKey.set(panelKey, {
        key: panelKey,
        title: '',
        markets: [market],
        buttons: [...buttons],
        volume: Number(market.volume ?? 0),
        mapNumber,
      })
    })

    return Array.from(panelsByKey.values())
      .map(panel => ({
        ...panel,
        title: panel.mapNumber != null
          ? resolveEsportsSegmentPanelTitle(panel.markets)
          : resolveSportsAuxiliaryMarketTitle(panel.markets),
        buttons: sortAuxiliaryButtons(dedupeAuxiliaryButtons(panel.buttons)),
      }))
      .sort((left, right) => {
        const mapComparison = (left.mapNumber ?? 0) - (right.mapNumber ?? 0)
        if (mapComparison !== 0) {
          return mapComparison
        }

        const segmentTypeComparison = resolveEsportsSegmentPanelSortOrder(left.markets)
          - resolveEsportsSegmentPanelSortOrder(right.markets)
        if (segmentTypeComparison !== 0) {
          return segmentTypeComparison
        }

        const thresholdComparison = resolveAuxiliaryPanelThreshold(left.markets)
          - resolveAuxiliaryPanelThreshold(right.markets)
        if (thresholdComparison !== 0) {
          return thresholdComparison
        }

        const timestampComparison = resolveAuxiliaryPanelCreatedAt(left.markets) - resolveAuxiliaryPanelCreatedAt(right.markets)
        if (timestampComparison !== 0) {
          return timestampComparison
        }

        return left.title.localeCompare(right.title)
      })
  }, [activeCard.buttons, activeCard.detailMarkets, activeCard.id, baseUsesSectionLayout, hasEsportsSegmentedLayout])
  const renderedAuxiliaryMarketCards = useMemo(() => {
    if (!hasEsportsSegmentedLayout) {
      return auxiliaryMarketCards
    }

    if (activeEsportsSegmentTabKey === 'series') {
      return auxiliaryMarketCards.filter(entry => entry.mapNumber == null)
    }

    if (activeEsportsSegmentNumber == null) {
      return []
    }

    return auxiliaryMarketCards.filter(entry => entry.mapNumber === activeEsportsSegmentNumber)
  }, [activeEsportsSegmentNumber, activeEsportsSegmentTabKey, auxiliaryMarketCards, hasEsportsSegmentedLayout])
  const seriesPreviewSegmentWinnerPanels = useMemo(() => {
    if (!hasEsportsSegmentedLayout) {
      return [] as AuxiliaryMarketPanel[]
    }

    return auxiliaryMarketCards.filter(entry =>
      entry.mapNumber != null
      && entry.markets.some(market => isSegmentedEsportsChildMoneylineMarket(market))
      && entry.buttons.every(button => button.marketType === 'moneyline'),
    )
  }, [auxiliaryMarketCards, hasEsportsSegmentedLayout])
  const activeSeriesPreviewSegmentWinnerPanel = useMemo(() => {
    if (seriesPreviewSegmentWinnerPanels.length === 0) {
      return null
    }

    return seriesPreviewSegmentWinnerPanels.find(entry => entry.mapNumber === activeSeriesPreviewSegmentNumber)
      ?? seriesPreviewSegmentWinnerPanels[0]
      ?? null
  }, [activeSeriesPreviewSegmentNumber, seriesPreviewSegmentWinnerPanels])
  const selectedSpreadSectionButton = useMemo(() => {
    if (selectedButtonBySection.spread) {
      const selected = activeCard.buttons.find(button => button.key === selectedButtonBySection.spread) ?? null
      if (selected?.marketType === 'spread') {
        return selected
      }
    }

    return groupedButtons.spread[0] ?? null
  }, [activeCard.buttons, groupedButtons.spread, selectedButtonBySection.spread])
  const selectedTotalSectionButton = useMemo(() => {
    if (selectedButtonBySection.total) {
      const selected = activeCard.buttons.find(button => button.key === selectedButtonBySection.total) ?? null
      if (selected?.marketType === 'total') {
        return selected
      }
    }

    return groupedButtons.total[0] ?? null
  }, [activeCard.buttons, groupedButtons.total, selectedButtonBySection.total])
  const seriesSpreadSegmentOptions = useMemo(() => {
    if (!hasEsportsSegmentedLayout) {
      return [] as Array<{
        number: number
        conditionIds: string[]
        buttonsByConditionId: Map<string, SportsGamesButton[]>
      }>
    }

    const byNumber = new Map<number, {
      number: number
      conditionIds: string[]
      buttonsByConditionId: Map<string, SportsGamesButton[]>
    }>()

    groupedButtons.spread.forEach((button) => {
      const market = detailMarketByConditionId.get(button.conditionId) ?? null
      const number = parseEsportsSegmentNumber(market)
      if (number == null) {
        return
      }

      const existing = byNumber.get(number)
      if (existing) {
        if (!existing.conditionIds.includes(button.conditionId)) {
          existing.conditionIds.push(button.conditionId)
        }
        const currentButtons = existing.buttonsByConditionId.get(button.conditionId) ?? []
        currentButtons.push(button)
        existing.buttonsByConditionId.set(button.conditionId, currentButtons)
        return
      }

      byNumber.set(number, {
        number,
        conditionIds: [button.conditionId],
        buttonsByConditionId: new Map([[button.conditionId, [button]]]),
      })
    })

    return Array.from(byNumber.values())
      .map(option => ({
        ...option,
        buttonsByConditionId: new Map(
          Array.from(option.buttonsByConditionId.entries())
            .map(([conditionId, buttons]) => [conditionId, sortSectionButtons('spread', buttons)] as const),
        ),
      }))
      .sort((left, right) => left.number - right.number)
  }, [detailMarketByConditionId, groupedButtons.spread, hasEsportsSegmentedLayout])
  const activeSeriesSpreadSegmentOption = useMemo(() => {
    if (seriesSpreadSegmentOptions.length === 0) {
      return null
    }

    if (activeSeriesSpreadPickerNumber != null) {
      const byPickerNumber = seriesSpreadSegmentOptions.find(option => option.number === activeSeriesSpreadPickerNumber)
      if (byPickerNumber) {
        return byPickerNumber
      }
    }

    const selectedMarket = selectedSpreadSectionButton
      ? detailMarketByConditionId.get(selectedSpreadSectionButton.conditionId) ?? null
      : null
    const selectedNumber = parseEsportsSegmentNumber(selectedMarket)
    if (selectedNumber != null) {
      return seriesSpreadSegmentOptions.find(option => option.number === selectedNumber)
        ?? seriesSpreadSegmentOptions[0]
        ?? null
    }

    return seriesSpreadSegmentOptions[0] ?? null
  }, [
    activeSeriesSpreadPickerNumber,
    detailMarketByConditionId,
    selectedSpreadSectionButton,
    seriesSpreadSegmentOptions,
  ])
  const activeSeriesSpreadSegmentNumber = activeSeriesSpreadSegmentOption?.number ?? null
  const activeSeriesSpreadConditionId = useMemo(() => {
    if (!activeSeriesSpreadSegmentOption) {
      return null
    }

    const currentSpreadConditionId = selectedSpreadSectionButton?.conditionId ?? null
    if (
      currentSpreadConditionId
      && activeSeriesSpreadSegmentOption.buttonsByConditionId.has(currentSpreadConditionId)
    ) {
      return currentSpreadConditionId
    }

    return activeSeriesSpreadSegmentOption.conditionIds[0] ?? null
  }, [activeSeriesSpreadSegmentOption, selectedSpreadSectionButton])
  const seriesSpreadSegmentPickerOptions = useMemo(
    () => seriesSpreadSegmentOptions.map(option => ({
      key: `spread-segment-${option.number}`,
      label: `${option.number}`,
      number: option.number,
    })),
    [seriesSpreadSegmentOptions],
  )
  const seriesWinnerSegmentPickerOptions = useMemo(
    () => seriesPreviewSegmentWinnerPanels
      .filter((panel): panel is AuxiliaryMarketPanel & { mapNumber: number } => panel.mapNumber != null)
      .map(panel => ({
        key: `winner-segment-${panel.mapNumber}`,
        label: `${panel.mapNumber}`,
        number: panel.mapNumber,
      })),
    [seriesPreviewSegmentWinnerPanels],
  )
  const seriesTotalLinePickerOptions = useMemo(() => {
    if (!hasEsportsSegmentedLayout) {
      return [] as SportsLinePickerOption[]
    }

    const allowedConditionIds = new Set(groupedButtons.total.map(button => button.conditionId))
    return buildLinePickerOptions(activeCard, 'total')
      .filter(option => allowedConditionIds.has(option.conditionId))
  }, [activeCard, groupedButtons.total, hasEsportsSegmentedLayout])
  const activeSeriesTotalLineOption = useMemo(() => {
    if (seriesTotalLinePickerOptions.length === 0) {
      return null
    }

    if (selectedTotalSectionButton) {
      return seriesTotalLinePickerOptions.find(option => option.conditionId === selectedTotalSectionButton.conditionId)
        ?? seriesTotalLinePickerOptions[0]
        ?? null
    }

    return seriesTotalLinePickerOptions[0] ?? null
  }, [selectedTotalSectionButton, seriesTotalLinePickerOptions])
  const activeSeriesTotalConditionId = activeSeriesTotalLineOption?.conditionId ?? null
  const activeSeriesTotalLineValue = activeSeriesTotalLineOption?.lineValue ?? null
  const seriesTotalPickerOptions = useMemo(
    () => seriesTotalLinePickerOptions.map(option => ({
      key: `total-line-${option.conditionId}`,
      label: option.label,
      number: option.lineValue,
    })),
    [seriesTotalLinePickerOptions],
  )
  const auxiliaryPanelsForSelection = auxiliaryMarketCards
  const auxiliaryPanelKeyByButtonKey = useMemo(() => {
    const map = new Map<string, string>()

    auxiliaryPanelsForSelection.forEach((entry) => {
      entry.buttons.forEach((button) => {
        map.set(button.key, entry.key)
      })
    })

    return map
  }, [auxiliaryPanelsForSelection])

  const handlePickSeriesPreviewSegmentNumber = useCallback((number: number) => {
    setActiveSeriesPreviewSegmentNumber(number)
  }, [])

  const handlePickSeriesSpreadSegmentNumber = useCallback((number: number) => {
    setActiveSeriesSpreadPickerNumber(number)

    const spreadOption = seriesSpreadSegmentOptions.find(option => option.number === number)
    if (!spreadOption) {
      return
    }

    const currentSpreadConditionId = selectedSpreadSectionButton?.conditionId ?? null
    const preferredConditionId = currentSpreadConditionId && spreadOption.buttonsByConditionId.has(currentSpreadConditionId)
      ? currentSpreadConditionId
      : spreadOption.conditionIds[0] ?? null
    if (!preferredConditionId) {
      return
    }

    const buttons = spreadOption.buttonsByConditionId.get(preferredConditionId) ?? []
    const preferredButton = resolvePreferredLinePickerButton(buttons, selectedSpreadSectionButton)
    if (!preferredButton) {
      return
    }

    updateSectionSelection('spread', preferredButton.key, { panelMode: 'preserve' })
  }, [selectedSpreadSectionButton, seriesSpreadSegmentOptions, updateSectionSelection])
  const handlePickSeriesTotalLineValue = useCallback((lineValue: number) => {
    const option = seriesTotalLinePickerOptions.find(candidate => candidate.lineValue === lineValue) ?? null
    if (!option) {
      return
    }

    const preferredButton = resolvePreferredLinePickerButton(option.buttons, selectedTotalSectionButton)
    if (!preferredButton) {
      return
    }

    updateSectionSelection('total', preferredButton.key, { panelMode: 'preserve' })
  }, [selectedTotalSectionButton, seriesTotalLinePickerOptions, updateSectionSelection])

  const resolveSeriesSpreadSelectedButtonKey = useCallback(() => {
    if (!activeSeriesSpreadSegmentOption) {
      return null
    }

    const preferredConditionId = activeSeriesSpreadConditionId
      ?? activeSeriesSpreadSegmentOption.conditionIds[0]
      ?? null
    if (!preferredConditionId) {
      return null
    }

    const buttons = activeSeriesSpreadSegmentOption.buttonsByConditionId.get(preferredConditionId) ?? []

    return resolvePreferredLinePickerButton(buttons, selectedSpreadSectionButton)?.key
      ?? null
  }, [activeSeriesSpreadConditionId, activeSeriesSpreadSegmentOption, selectedSpreadSectionButton])
  const resolveSeriesTotalSelectedButtonKey = useCallback(() => {
    if (!activeSeriesTotalLineOption) {
      return null
    }

    return resolvePreferredLinePickerButton(activeSeriesTotalLineOption.buttons, selectedTotalSectionButton)?.key
      ?? null
  }, [activeSeriesTotalLineOption, selectedTotalSectionButton])

  useEffect(() => {
    const selectedMarket = selectedSpreadSectionButton
      ? detailMarketByConditionId.get(selectedSpreadSectionButton.conditionId) ?? null
      : null
    const selectedNumber = parseEsportsSegmentNumber(selectedMarket)
    if (selectedNumber == null) {
      return
    }

    setActiveSeriesSpreadPickerNumber(current => current === selectedNumber ? current : selectedNumber)
  }, [detailMarketByConditionId, selectedSpreadSectionButton])

  useEffect(() => {
    const isNewCard = previousCardIdRef.current !== activeCard.id
    previousCardIdRef.current = activeCard.id
    const marketSlugSelectionSignature = buildMarketSlugSelectionSignature({
      activeCardId: activeCard.id,
      marketSlugToButtonKey,
      usesSectionLayout,
    })
    const shouldApplyMarketSlugSelection = marketSlugSelectionSignature !== null
      && appliedMarketSlugSelectionRef.current !== marketSlugSelectionSignature

    if (!marketSlugSelectionSignature) {
      appliedMarketSlugSelectionRef.current = null
    }

    const defaultSelectedByCondition = auxiliaryPanelsForSelection.reduce<Record<string, string | null>>((acc, entry) => {
      const marketMatchedButton = shouldApplyMarketSlugSelection
        && marketSlugToButtonKey
        && entry.buttons.some(button => button.key === marketSlugToButtonKey)
        ? marketSlugToButtonKey
        : null
      const defaultButtonKey = entry.buttons[0]?.key ?? null
      acc[entry.key] = marketMatchedButton ?? defaultButtonKey
      return acc
    }, {})

    setSelectedAuxiliaryButtonByConditionId((current) => {
      if (isNewCard) {
        return areRecordValuesEqual(current, defaultSelectedByCondition)
          ? current
          : defaultSelectedByCondition
      }

      const next = { ...defaultSelectedByCondition }
      Object.entries(current).forEach(([conditionId, buttonKey]) => {
        if (!buttonKey) {
          return
        }

        const matchedEntry = auxiliaryPanelsForSelection.find(entry => entry.key === conditionId)
        if (!matchedEntry) {
          return
        }

        if (matchedEntry.buttons.some(button => button.key === buttonKey)) {
          next[conditionId] = buttonKey
        }
      })

      if (shouldApplyMarketSlugSelection && marketSlugToButtonKey) {
        const matchedEntry = auxiliaryPanelsForSelection.find(entry =>
          entry.buttons.some(button => button.key === marketSlugToButtonKey),
        )
        if (matchedEntry) {
          next[matchedEntry.key] = marketSlugToButtonKey
        }
      }

      return areRecordValuesEqual(current, next) ? current : next
    })

    setTabByAuxiliaryConditionId((current) => {
      const next = { ...current }
      let changed = false
      auxiliaryPanelsForSelection.forEach(({ key }) => {
        if (!next[key]) {
          next[key] = 'orderBook'
          changed = true
        }
      })
      return changed ? next : current
    })

    const marketMatchedAuxiliaryConditionId = shouldApplyMarketSlugSelection && marketSlugToButtonKey
      ? auxiliaryPanelsForSelection.find(entry => entry.buttons.some(button => button.key === marketSlugToButtonKey))?.key ?? null
      : null

    if (!usesSectionLayout) {
      const defaultTradeButton = (shouldApplyMarketSlugSelection ? marketSlugToButtonKey : null)
        ?? renderedAuxiliaryMarketCards[0]?.buttons[0]?.key
        ?? auxiliaryPanelsForSelection[0]?.buttons[0]?.key
        ?? resolveDefaultConditionId(activeCard)

      setActiveTradeButtonKey((current) => {
        if (
          shouldApplyMarketSlugSelection
          && marketSlugToButtonKey
          && activeCard.buttons.some(button => button.key === marketSlugToButtonKey)
        ) {
          return marketSlugToButtonKey
        }

        if (!isNewCard && current && activeCard.buttons.some(button => button.key === current)) {
          return current
        }

        return defaultTradeButton
      })

      setOpenSectionKey(null)
      setOpenAuxiliaryConditionId((current) => {
        if (marketMatchedAuxiliaryConditionId) {
          return marketMatchedAuxiliaryConditionId
        }

        if (isNewCard) {
          return null
        }

        if (current && renderedAuxiliaryMarketCards.some(entry => entry.key === current)) {
          return current
        }

        return null
      })
      if (marketSlugSelectionSignature) {
        appliedMarketSlugSelectionRef.current = marketSlugSelectionSignature
      }
      return
    }

    const defaultSelectedBySection: Record<EventSectionKey, string | null> = {
      moneyline: null,
      spread: null,
      total: null,
      btts: null,
    }

    for (const section of SECTION_ORDER) {
      const firstButton = groupedButtons[section.key][0] ?? null
      defaultSelectedBySection[section.key] = firstButton?.key ?? null
    }

    if (shouldApplyMarketSlugSelection && marketSlugToButtonKey) {
      const marketButton = activeCard.buttons.find(button => button.key === marketSlugToButtonKey)
      const market = marketButton
        ? (detailMarketByConditionId.get(marketButton.conditionId) ?? null)
        : null
      const sectionKey = resolveEventSectionKeyForButton(marketButton, market)
      if (marketButton && sectionKey) {
        defaultSelectedBySection[sectionKey] = marketButton.key
      }
    }

    setSelectedButtonBySection((current) => {
      if (isNewCard) {
        return areRecordValuesEqual(current, defaultSelectedBySection)
          ? current
          : defaultSelectedBySection
      }

      const next: Record<EventSectionKey, string | null> = {
        ...defaultSelectedBySection,
      }

      for (const section of SECTION_ORDER) {
        const currentButtonKey = current[section.key]
        if (!currentButtonKey) {
          continue
        }

        const stillExists = groupedButtons[section.key].some(button => button.key === currentButtonKey)
        if (stillExists) {
          next[section.key] = currentButtonKey
        }
      }

      if (shouldApplyMarketSlugSelection && marketSlugToButtonKey) {
        const marketButton = activeCard.buttons.find(button => button.key === marketSlugToButtonKey)
        const market = marketButton
          ? (detailMarketByConditionId.get(marketButton.conditionId) ?? null)
          : null
        const sectionKey = resolveEventSectionKeyForButton(marketButton, market)
        if (marketButton && sectionKey) {
          next[sectionKey] = marketButton.key
        }
      }

      return areRecordValuesEqual(current, next) ? current : next
    })

    const defaultTradeButton = (shouldApplyMarketSlugSelection ? marketSlugToButtonKey : null)
      ?? defaultSelectedBySection.moneyline
      ?? defaultSelectedBySection.spread
      ?? defaultSelectedBySection.total
      ?? defaultSelectedBySection.btts
      ?? resolveDefaultConditionId(activeCard)

    setActiveTradeButtonKey((current) => {
      if (shouldApplyMarketSlugSelection && marketSlugToButtonKey) {
        const matchesMarketSlug = activeCard.buttons.some(button => button.key === marketSlugToButtonKey)
        if (matchesMarketSlug) {
          return marketSlugToButtonKey
        }
      }

      if (!isNewCard && current) {
        const stillExists = activeCard.buttons.some(button => button.key === current)
        if (stillExists) {
          return current
        }
      }

      return defaultTradeButton
    })

    setOpenSectionKey((current) => {
      if (isNewCard) {
        return null
      }
      if (current && groupedButtons[current].length > 0) {
        return current
      }
      return null
    })
    setOpenAuxiliaryConditionId((current) => {
      if (marketMatchedAuxiliaryConditionId) {
        return marketMatchedAuxiliaryConditionId
      }

      if (!isNewCard && current && renderedAuxiliaryMarketCards.some(entry => entry.key === current)) {
        return current
      }

      return null
    })
    if (marketSlugSelectionSignature) {
      appliedMarketSlugSelectionRef.current = marketSlugSelectionSignature
    }
  }, [
    activeCard,
    activeCard.id,
    activeCard.buttons,
    auxiliaryPanelsForSelection,
    detailMarketByConditionId,
    groupedButtons,
    usesSectionLayout,
    marketSlugToButtonKey,
    renderedAuxiliaryMarketCards,
  ])

  useEffect(() => {
    if (!hasEsportsSegmentedLayout || !marketSlugToButtonKey) {
      return
    }

    const selectedButton = activeCard.buttons.find(button => button.key === marketSlugToButtonKey) ?? null
    const selectedMarket = selectedButton
      ? detailMarketByConditionId.get(selectedButton.conditionId) ?? null
      : null

    if (!selectedMarket) {
      return
    }

    const mapNumber = parseEsportsSegmentNumber(selectedMarket)
    if (mapNumber != null) {
      setActiveEsportsSegmentTabKey(resolveEsportsSegmentTabKey(mapNumber))
      return
    }

    setActiveEsportsSegmentTabKey('series')
  }, [activeCard.buttons, detailMarketByConditionId, hasEsportsSegmentedLayout, marketSlugToButtonKey])

  const moneylineButtonKey = selectedButtonBySection.moneyline ?? groupedButtons.moneyline[0]?.key ?? null
  const orderSelectionSyncKey = useMemo(() => {
    if (!orderEventId || !orderMarketConditionId || orderOutcomeIndex == null) {
      return null
    }

    return `${orderEventId}:${orderMarketConditionId}:${orderOutcomeIndex}`
  }, [orderEventId, orderMarketConditionId, orderOutcomeIndex])
  const fallbackButtonFromOrderState = useMemo(() => {
    if (orderEventId !== activeCard.event.id || !orderMarketConditionId) {
      return null
    }

    if (orderOutcomeIndex === OUTCOME_INDEX.YES || orderOutcomeIndex === OUTCOME_INDEX.NO) {
      const exactButton = activeCard.buttons.find(button =>
        button.conditionId === orderMarketConditionId && button.outcomeIndex === orderOutcomeIndex,
      )
      if (exactButton) {
        return exactButton.key
      }
    }

    const conditionButton = activeCard.buttons.find(button => button.conditionId === orderMarketConditionId)
    return conditionButton?.key ?? null
  }, [activeCard.buttons, activeCard.event.id, orderEventId, orderMarketConditionId, orderOutcomeIndex])

  const activeTradeContext = useMemo(() => {
    const candidateKeys = usesSectionLayout
      ? [
          activeTradeButtonKey,
          openSectionKey ? selectedButtonBySection[openSectionKey] : null,
          openAuxiliaryConditionId ? selectedAuxiliaryButtonByConditionId[openAuxiliaryConditionId] : null,
          marketSlugToButtonKey,
          fallbackButtonFromOrderState,
          renderedAuxiliaryMarketCards[0]?.buttons[0]?.key ?? null,
          moneylineButtonKey,
          selectedButtonBySection.spread,
          selectedButtonBySection.total,
          selectedButtonBySection.btts,
          resolveDefaultConditionId(activeCard),
        ]
      : [
          activeTradeButtonKey,
          openAuxiliaryConditionId ? selectedAuxiliaryButtonByConditionId[openAuxiliaryConditionId] : null,
          marketSlugToButtonKey,
          fallbackButtonFromOrderState,
          renderedAuxiliaryMarketCards[0]?.buttons[0]?.key ?? null,
          resolveDefaultConditionId(activeCard),
        ]
    const effectiveButtonKey = candidateKeys.find((buttonKey) => {
      if (!buttonKey) {
        return false
      }

      return activeCard.buttons.some(button => button.key === buttonKey)
    }) ?? null
    if (!effectiveButtonKey) {
      return null
    }

    const button = resolveSelectedButton(activeCard, effectiveButtonKey)
    if (!button) {
      return null
    }

    const market = resolveSelectedMarket(activeCard, button.key)
    if (!market) {
      return null
    }

    const outcome = resolveSelectedOutcome(market, button)
    if (!outcome) {
      return null
    }

    return { button, market, outcome }
  }, [
    activeTradeButtonKey,
    activeCard,
    fallbackButtonFromOrderState,
    usesSectionLayout,
    moneylineButtonKey,
    marketSlugToButtonKey,
    openAuxiliaryConditionId,
    openSectionKey,
    renderedAuxiliaryMarketCards,
    selectedAuxiliaryButtonByConditionId,
    selectedButtonBySection,
  ])

  useEffect(() => {
    if (marketSlugToButtonKey) {
      return
    }

    if (orderSelectionSyncKey && orderSelectionSyncKey === pushedOrderSelectionRef.current) {
      return
    }

    if (!fallbackButtonFromOrderState) {
      return
    }

    const matchedButton = activeCard.buttons.find(
      button => button.key === fallbackButtonFromOrderState,
    )
    if (!matchedButton) {
      return
    }

    setActiveTradeButtonKey((current) => {
      if (current === matchedButton.key) {
        return current
      }
      return matchedButton.key
    })

    if (usesSectionLayout) {
      const matchedMarket = detailMarketByConditionId.get(matchedButton.conditionId) ?? null
      const sectionKey = resolveEventSectionKeyForButton(matchedButton, matchedMarket)
      if (sectionKey) {
        setSelectedButtonBySection((current) => {
          if (current[sectionKey] === matchedButton.key) {
            return current
          }

          return {
            ...current,
            [sectionKey]: matchedButton.key,
          }
        })
        return
      }
    }

    setSelectedAuxiliaryButtonByConditionId((current) => {
      const auxiliaryPanelKey = auxiliaryPanelKeyByButtonKey.get(matchedButton.key) ?? matchedButton.conditionId

      if (current[auxiliaryPanelKey] === matchedButton.key) {
        return current
      }

      return {
        ...current,
        [auxiliaryPanelKey]: matchedButton.key,
      }
    })
  }, [
    activeCard.buttons,
    auxiliaryPanelKeyByButtonKey,
    detailMarketByConditionId,
    fallbackButtonFromOrderState,
    marketSlugToButtonKey,
    orderSelectionSyncKey,
    usesSectionLayout,
  ])

  const activeTradeHeaderContext = useMemo(() => {
    if (!activeTradeContext) {
      return null
    }

    if (!orderMarketConditionId || orderMarketConditionId !== activeTradeContext.market.condition_id) {
      return activeTradeContext
    }

    if (orderOutcomeIndex == null) {
      return activeTradeContext
    }

    const matchedOutcome = activeTradeContext.market.outcomes.find(
      outcome => outcome.outcome_index === orderOutcomeIndex,
    ) ?? activeTradeContext.outcome

    const matchedButton = activeCard.buttons.find(
      button => (
        button.conditionId === activeTradeContext.market.condition_id
        && button.outcomeIndex === orderOutcomeIndex
      ),
    ) ?? activeTradeContext.button

    return {
      ...activeTradeContext,
      button: matchedButton,
      outcome: matchedOutcome,
    }
  }, [activeTradeContext, activeCard.buttons, orderMarketConditionId, orderOutcomeIndex])
  const orderPanelOutcomeLabelOverrides = useMemo(
    () => activeTradeContext
      ? resolveOrderPanelOutcomeLabelOverrides(
          activeCard,
          activeTradeHeaderContext?.market ?? activeTradeContext.market,
        )
      : {},
    [activeCard, activeTradeContext, activeTradeHeaderContext],
  )
  const orderPanelOutcomeAccentOverrides = useMemo(
    () => activeTradeContext
      ? resolveOrderPanelOutcomeAccentOverrides(
          activeCard,
          activeTradeHeaderContext?.market ?? activeTradeContext.market,
        )
      : {},
    [activeCard, activeTradeContext, activeTradeHeaderContext],
  )
  const pageAboutMarket = activeTradeHeaderContext?.market ?? activeTradeContext?.market ?? null

  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(activeCard, activeTradeContext.button.conditionId)
  }, [activeCard, activeTradeContext])

  const activeTradeContextButtonKey = activeTradeContext?.button.key ?? null

  useEffect(() => {
    currentOrderSelectionRef.current = {
      eventId: orderEventId,
      conditionId: orderMarketConditionId,
      outcomeIndex: orderOutcomeIndex,
    }
  }, [orderEventId, orderMarketConditionId, orderOutcomeIndex])

  useEffect(() => {
    if (!activeTradeContextButtonKey) {
      pushedOrderSelectionRef.current = null
      return
    }

    const button = resolveSelectedButton(activeCard, activeTradeContextButtonKey)
    const market = resolveSelectedMarket(activeCard, activeTradeContextButtonKey)
    const outcome = resolveSelectedOutcome(market, button)
    if (!button || !market || !outcome) {
      pushedOrderSelectionRef.current = null
      return
    }

    const nextOrderSelectionSyncKey = `${activeCard.event.id}:${market.condition_id}:${outcome.outcome_index}`
    const {
      eventId: currentOrderEventId,
      conditionId: currentOrderMarketConditionId,
      outcomeIndex: currentOrderOutcomeIndex,
    } = currentOrderSelectionRef.current

    if (
      currentOrderEventId === activeCard.event.id
      && currentOrderMarketConditionId === market.condition_id
      && currentOrderOutcomeIndex === outcome.outcome_index
    ) {
      pushedOrderSelectionRef.current = nextOrderSelectionSyncKey
      return
    }

    pushedOrderSelectionRef.current = nextOrderSelectionSyncKey
    setOrderEvent(activeCard.event)
    setOrderMarket(market)
    setOrderOutcome(outcome)
    setOrderSide(ORDER_SIDE.BUY)
  }, [
    activeCard,
    activeTradeContextButtonKey,
    setOrderEvent,
    setOrderMarket,
    setOrderOutcome,
    setOrderSide,
  ])

  const sectionVolumes = useMemo(() => {
    const byConditionId = new Map(activeCard.detailMarkets.map(market => [market.condition_id, market] as const))
    const volumes: Record<EventSectionKey, number> = {
      moneyline: 0,
      spread: 0,
      total: 0,
      btts: 0,
    }

    for (const section of SECTION_ORDER) {
      const conditionIds = Array.from(new Set(groupedButtons[section.key].map(button => button.conditionId)))
      volumes[section.key] = conditionIds.reduce((sum, conditionId) => {
        const market = byConditionId.get(conditionId)
        return sum + (Number(market?.volume ?? 0) || 0)
      }, 0)
    }

    return volumes
  }, [activeCard.detailMarkets, groupedButtons])

  const sectionConditionIdsByKey = useMemo<Record<EventSectionKey, Set<string>>>(() => {
    return {
      moneyline: new Set(groupedButtons.moneyline.map(button => button.conditionId)),
      spread: new Set(groupedButtons.spread.map(button => button.conditionId)),
      total: new Set(groupedButtons.total.map(button => button.conditionId)),
      btts: new Set(groupedButtons.btts.map(button => button.conditionId)),
    }
  }, [groupedButtons])

  function resolveSectionButtons(sectionKey: EventSectionKey, preferredConditionId?: string | null) {
    const sectionButtons = groupedButtons[sectionKey]
    if (sectionButtons.length === 0) {
      return [] as SportsGamesButton[]
    }

    if (sectionKey === 'moneyline') {
      return sortSectionButtons(sectionKey, sectionButtons)
    }

    const byConditionId = new Map<string, SportsGamesButton[]>()
    sectionButtons.forEach((button) => {
      const existing = byConditionId.get(button.conditionId)
      if (existing) {
        existing.push(button)
      }
      else {
        byConditionId.set(button.conditionId, [button])
      }
    })

    const selectedButtonKey = selectedButtonBySection[sectionKey]
    const selectedButton = selectedButtonKey
      ? sectionButtons.find(button => button.key === selectedButtonKey) ?? null
      : null
    const activeConditionId = preferredConditionId
      ?? selectedButton?.conditionId
      ?? sectionButtons[0]?.conditionId
    const activeConditionButtons = activeConditionId ? (byConditionId.get(activeConditionId) ?? []) : []

    return sortSectionButtons(sectionKey, activeConditionButtons)
  }

  function updateSectionSelection(
    sectionKey: EventSectionKey,
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) {
    setSelectedButtonBySection((current) => {
      if (current[sectionKey] === buttonKey) {
        return current
      }
      return {
        ...current,
        [sectionKey]: buttonKey,
      }
    })

    setActiveTradeButtonKey(buttonKey)

    const panelMode = options?.panelMode ?? 'full'
    const shouldOpenMobileSheetOnly = isMobile && panelMode === 'full'

    if (shouldOpenMobileSheetOnly) {
      setIsMobileOrderPanelOpen(true)
    }

    if (panelMode === 'full' && !shouldOpenMobileSheetOnly) {
      setOpenAuxiliaryConditionId(null)
      setOpenSectionKey(sectionKey)
    }
  }

  function updateAuxiliarySelection(
    conditionId: string,
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) {
    setSelectedAuxiliaryButtonByConditionId((current) => {
      if (current[conditionId] === buttonKey) {
        return current
      }

      return {
        ...current,
        [conditionId]: buttonKey,
      }
    })

    setActiveTradeButtonKey(buttonKey)

    const panelMode = options?.panelMode ?? 'full'
    const shouldOpenMobileSheetOnly = isMobile && panelMode === 'full'

    if (shouldOpenMobileSheetOnly) {
      setIsMobileOrderPanelOpen(true)
    }

    if (panelMode === 'full' && !shouldOpenMobileSheetOnly) {
      setOpenSectionKey(null)
      setOpenAuxiliaryConditionId(conditionId)
    }
  }

  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const startDate = heroCard.startTime
    ? new Date(heroCard.startTime)
    : heroCard.event.sports_start_time
      ? new Date(heroCard.event.sports_start_time)
      : heroCard.event.start_date
        ? new Date(heroCard.event.start_date)
        : null
  const hasValidStartDate = Boolean(startDate && !Number.isNaN(startDate.getTime()))
  const timeLabel = hasValidStartDate
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(startDate as Date)
    : 'TBD'
  const dayLabel = hasValidStartDate
    ? new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(startDate as Date)
    : 'Date TBD'

  const team1 = heroCard.teams[0] ?? null
  const team2 = heroCard.teams[1] ?? null
  const useFullCompetitorHeroLabels = shouldUseFullScoreboardHeroLabels({
    sportSlug: heroCard.event.sports_sport_slug ?? sportSlug,
    vertical,
  })
  const heroTeam1Label = useFullCompetitorHeroLabels ? (team1?.name ?? '—') : (team1?.abbreviation ?? '—')
  const heroTeam2Label = useFullCompetitorHeroLabels ? (team2?.name ?? '—') : (team2?.abbreviation ?? '—')
  const useCroppedHeroTeamLogo = shouldUseCroppedSportsTeamLogo(heroCard.event.sports_sport_slug ?? sportSlug)
  const shortTeam1Label = resolveTeamShortLabel(team1)
  const shortTeam2Label = resolveTeamShortLabel(team2)
  const eventShortLabel = `${shortTeam1Label} vs. ${shortTeam2Label}`
  const eventTitle = team1 && team2
    ? `${team1.name} vs ${team2.name}`
    : heroCard.title
  const hasLivestreamUrl = Boolean(heroCard.event.livestream_url?.trim())
  const canWatchLivestream = (
    hasLivestreamUrl
    && heroCard.event.sports_ended !== true
    && heroCard.event.sports_live !== false
  )
  const normalizedEventLivestreamUrl = useMemo(
    () => normalizeLivestreamUrl(heroCard.event.livestream_url),
    [heroCard.event.livestream_url],
  )
  const isCurrentEventLivestreamOpen = normalizedEventLivestreamUrl !== null
    && normalizedEventLivestreamUrl === activeStreamUrl
  const showFinalScore = heroCard.event.sports_ended === true
  const hasStarted = (
    currentTimestamp != null
    && hasValidStartDate
    && (startDate as Date).getTime() <= currentTimestamp
  )
  const showLiveScore = !showFinalScore && (heroCard.event.sports_live === true || hasStarted)
  const parsedScore = parseSportsScore(heroCard.event.sports_score)
  const team1Score = showLiveScore ? (parsedScore?.team1 ?? 0) : parsedScore?.team1
  const team2Score = showLiveScore ? (parsedScore?.team2 ?? 0) : parsedScore?.team2
  const team1Won = team1Score != null && team2Score != null && team1Score > team2Score
  const team2Won = team1Score != null && team2Score != null && team2Score > team1Score

  const heroMoneylineButtonKey = heroCard.buttons.some(button => button.key === moneylineButtonKey)
    ? moneylineButtonKey
    : heroGroupedButtons.moneyline[0]?.key
      ?? heroCard.buttons.find(button => button.marketType === 'moneyline')?.key
      ?? null
  const heroMoneylineSelectedButton = resolveSelectedButton(heroCard, heroMoneylineButtonKey)
  const graphConditionId = heroMoneylineSelectedButton?.conditionId ?? null
  const allCardConditionIds = useMemo(
    () => new Set(activeCard.detailMarkets.map(market => market.condition_id)),
    [activeCard.detailMarkets],
  )
  const redeemSectionConfig = useMemo(
    () => (redeemSectionKey ? SECTION_ORDER.find(section => section.key === redeemSectionKey) ?? null : null),
    [redeemSectionKey],
  )
  const redeemModalSections = useMemo<SportsRedeemModalSection[]>(
    () =>
      SECTION_ORDER
        .map(section => ({
          key: section.key,
          label: section.label,
          groups: claimGroupsBySection[section.key],
        }))
        .filter(section => section.groups.length > 0),
    [claimGroupsBySection],
  )
  const auxiliaryResolvedByConditionId = useMemo(
    () => new Map(auxiliaryPanelsForSelection.map(entry => [
      entry.key,
      entry.markets.every(market => Boolean(market.is_resolved || market.condition?.resolved)),
    ] as const)),
    [auxiliaryPanelsForSelection],
  )
  const auxiliaryClaimGroupsByConditionId = useMemo(
    () => new Map(claimGroupsBySection.moneyline.map(group => [group.conditionId, group] as const)),
    [claimGroupsBySection],
  )
  const handleOpenRedeemForCondition = useCallback((conditionId: string) => {
    const normalizedConditionId = conditionId.trim()
    if (!normalizedConditionId) {
      return
    }

    const matchedSection = SECTION_ORDER.find(section =>
      claimGroupsBySection[section.key].some(group => group.conditionId === normalizedConditionId),
    ) ?? SECTION_ORDER.find(section => sectionConditionIdsByKey[section.key].has(normalizedConditionId))
    ?? SECTION_ORDER.find(section => claimGroupsBySection[section.key].length > 0)
    ?? null

    if (!matchedSection) {
      return
    }

    setRedeemDefaultConditionId(normalizedConditionId)
    setRedeemSectionKey(matchedSection.key)
  }, [claimGroupsBySection, sectionConditionIdsByKey])
  const esportsSegmentTabs = hasEsportsSegmentedLayout
    ? [
        { key: 'series' as const, label: 'Series Lines' },
        ...esportsSegmentTabNumbers.map(mapNumber => ({ key: resolveEsportsSegmentTabKey(mapNumber), label: `${segmentLabel} ${mapNumber}` })),
      ]
    : []
  const marketViewTabs = hasMultipleMarketViews
    ? (
        <div className="mb-4 flex flex-wrap items-center gap-5 border-b border-border/70">
          {normalizedMarketViewCards.map((view) => {
            const isActive = view.key === activeMarketView?.key

            return (
              <button
                key={view.key}
                type="button"
                onClick={() => setActiveMarketViewKey(view.key)}
                className={cn(
                  'border-b-2 pb-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {view.label}
              </button>
            )
          })}
        </div>
      )
    : null
  const esportsEventTabs = esportsSegmentTabs.length > 1
    ? (
        <div className="mb-5 flex flex-wrap items-center gap-4 sm:gap-6">
          {esportsSegmentTabs.map((tab) => {
            const isActive = tab.key === activeEsportsSegmentTabKey

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveEsportsSegmentTabKey(tab.key)}
                className={cn(
                  'text-sm font-semibold transition-colors sm:text-base',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )
    : null
  const auxiliaryMarketPanels = renderedAuxiliaryMarketCards.map((entry) => {
    const panelKey = entry.key
    const selectedButtonKey = selectedAuxiliaryButtonByConditionId[panelKey] ?? entry.buttons[0]?.key ?? null
    const isOpen = openAuxiliaryConditionId === panelKey
    const activeTab = tabByAuxiliaryConditionId[panelKey] ?? 'orderBook'
    const isResolved = auxiliaryResolvedByConditionId.get(panelKey) === true
    const singleConditionId = entry.markets.length === 1
      ? entry.markets[0]?.condition_id ?? null
      : null
    const claimGroup = singleConditionId ? (auxiliaryClaimGroupsByConditionId.get(singleConditionId) ?? null) : null
    const shouldShowRedeemButton = Boolean(singleConditionId && isResolved && claimGroup)
    const marketTitle = entry.title
    const panelVolume = Number(entry.volume)
    const firstButtonKey = entry.buttons[0]?.key ?? null
    const isMoneylinePanel = entry.buttons.every(button => button.marketType === 'moneyline')
    const shouldShowResolvedSegmentedButtons = hasEsportsSegmentedLayout && entry.mapNumber != null
    const shouldRenderButtons = (!isResolved || shouldShowResolvedSegmentedButtons) && entry.buttons.length > 0

    function toggleCondition() {
      setOpenAuxiliaryConditionId(current => current === panelKey ? null : panelKey)
    }

    function handleCardClick(event: React.MouseEvent<HTMLElement>) {
      const target = event.target as HTMLElement
      if (target.closest('[data-sports-card-control="true"]')) {
        return
      }
      if (firstButtonKey) {
        updateAuxiliarySelection(panelKey, firstButtonKey, { panelMode: 'preserve' })
      }
      toggleCondition()
    }

    function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }
      const target = event.target as HTMLElement
      if (target.closest('[data-sports-card-control="true"]')) {
        return
      }
      event.preventDefault()
      if (firstButtonKey) {
        updateAuxiliarySelection(panelKey, firstButtonKey, { panelMode: 'preserve' })
      }
      toggleCondition()
    }

    return (
      <article
        key={`${activeCard.id}-${panelKey}`}
        className="overflow-hidden rounded-xl border bg-card"
      >
        <div
          className={cn(
            `
              flex w-full cursor-pointer flex-col items-stretch gap-3 px-4 py-[18px] transition-colors
              sm:flex-row sm:items-center
            `,
            'hover:bg-secondary/30',
          )}
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
        >
          <div className="min-w-0 text-left transition-colors hover:text-foreground/90">
            <h3 className="text-sm font-semibold text-foreground">{marketTitle}</h3>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              {formatVolume(panelVolume)}
              {' '}
              Vol.
            </p>
          </div>

          {shouldRenderButtons && (
            <div
              className={cn(
                isMoneylinePanel
                  ? `
                    grid w-full items-stretch gap-2
                    sm:ml-auto sm:flex sm:w-auto sm:flex-none sm:flex-wrap sm:justify-end
                  `
                  : 'grid min-w-0 flex-1 items-stretch gap-2',
                !isMoneylinePanel && (
                  entry.buttons.length >= 3
                    ? 'min-[1200px]:ml-auto min-[1200px]:w-[380px] min-[1200px]:flex-none'
                    : 'min-[1200px]:ml-auto min-[1200px]:w-[248px] min-[1200px]:flex-none'
                ),
                isMoneylinePanel
                  ? resolveMoneylineButtonGridClass(entry.buttons.length)
                  : (entry.buttons.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'),
              )}
            >
              {entry.buttons.map((button) => {
                const isActive = activeTradeButtonKey === button.key
                const hasTeamColor = (button.tone === 'team1' || button.tone === 'team2')
                  && (button.marketType === 'moneyline' || isActive)
                const isOverButton = isActive && button.tone === 'over'
                const isUnderButton = isActive && button.tone === 'under'
                const buttonOverlayStyle = hasTeamColor
                  ? resolveButtonOverlayStyle(button.color, button.tone)
                  : undefined

                return (
                  <div
                    key={`${panelKey}-${button.key}`}
                    className={cn(
                      'relative min-w-0 overflow-hidden rounded-lg pb-1.25',
                      isMoneylinePanel && 'w-full sm:w-[118px] sm:shrink-0',
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
                        event.stopPropagation()
                        updateAuxiliarySelection(panelKey, button.key, {
                          panelMode: isResolved ? 'preserve' : 'full',
                        })
                      }}
                      style={hasTeamColor ? resolveButtonStyle(button.color, button.tone) : undefined}
                      className={cn(
                        `
                          relative flex h-9 w-full translate-y-0 items-center rounded-lg text-xs font-semibold shadow-sm
                          transition-transform duration-150 ease-out
                          hover:translate-y-px
                          active:translate-y-0.5
                        `,
                        isMoneylinePanel
                          ? 'justify-center px-2'
                          : 'justify-between px-3',
                        !hasTeamColor && !isOverButton && !isUnderButton
                        && 'bg-secondary text-secondary-foreground hover:bg-accent',
                        isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                        isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                      )}
                    >
                      {buttonOverlayStyle
                        ? <span className="pointer-events-none absolute inset-0 rounded-lg" style={buttonOverlayStyle} />
                        : null}
                      {isMoneylinePanel
                        ? (
                            <>
                              <span className="relative z-1 mr-1 uppercase opacity-80">{button.label}</span>
                              <span className={cn(
                                'relative z-1 text-sm leading-none tabular-nums transition-opacity',
                                isActive ? 'opacity-100' : 'opacity-45',
                              )}
                              >
                                {formatButtonOdds(buttonPriceCentsByKey.get(button.key) ?? button.cents)}
                              </span>
                            </>
                          )
                        : (
                            <>
                              <span className="uppercase opacity-80">{button.label}</span>
                              <span className="text-sm leading-none tabular-nums">
                                {formatButtonOdds(buttonPriceCentsByKey.get(button.key) ?? button.cents)}
                              </span>
                            </>
                          )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {shouldShowRedeemButton && (
            <div
              className="
                min-w-0 flex-1
                min-[1200px]:ml-auto min-[1200px]:w-[calc((248px-0.5rem)/2)] min-[1200px]:flex-none
              "
            >
              <div className="relative min-w-0 overflow-hidden rounded-lg pb-1.25">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg bg-primary" />
                <button
                  type="button"
                  data-sports-card-control="true"
                  onClick={(event) => {
                    event.stopPropagation()
                    setRedeemDefaultConditionId(singleConditionId)
                    setRedeemSectionKey('moneyline')
                  }}
                  className={`
                    relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg bg-primary px-3
                    text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-150 ease-out
                    hover:translate-y-px hover:bg-primary
                    active:translate-y-0.5
                  `}
                >
                  Redeem
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cn('bg-card px-2.5', isOpen ? 'border-t pt-3' : 'pt-0')}>
          <SportsGameDetailsPanel
            card={activeCard}
            activeDetailsTab={activeTab}
            selectedButtonKey={selectedButtonKey}
            showBottomContent={isOpen}
            defaultGraphTimeRange="ALL"
            allowedConditionIds={new Set(entry.markets.map(market => market.condition_id))}
            showAboutTab
            aboutEvent={activeCard.event}
            rulesEvent={heroCard.event}
            showRedeemInPositions
            marketContextEnabled={marketContextEnabled}
            onOpenRedeemForCondition={handleOpenRedeemForCondition}
            oddsFormat={oddsFormat}
            onChangeTab={tab => setTabByAuxiliaryConditionId(current => ({ ...current, [panelKey]: tab }))}
            onSelectButton={(buttonKey, options) => {
              updateAuxiliarySelection(panelKey, buttonKey, options)
            }}
          />
        </div>
      </article>
    )
  })
  const nonSectionAuxiliaryMarketPanels = auxiliaryMarketPanels
  const seriesPreviewSegmentWinnerCard = activeSeriesPreviewSegmentWinnerPanel
    && hasEsportsSegmentedLayout
    && activeEsportsSegmentTabKey === 'series'
    ? (() => {
        const entry = activeSeriesPreviewSegmentWinnerPanel
        const selectedButtonKey = selectedAuxiliaryButtonByConditionId[entry.key] ?? entry.buttons[0]?.key ?? null
        const isResolved = entry.markets.every(market => Boolean(market.is_resolved || market.condition?.resolved))

        return (
          <article
            key={`${activeCard.id}-series-preview-${entry.key}`}
            className="overflow-hidden rounded-xl border bg-card"
          >
            <div
              className="flex w-full flex-col items-stretch gap-3 px-4 py-[18px] sm:flex-row sm:items-center"
            >
              <div className="min-w-0 text-left">
                <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  {formatVolume(entry.volume)}
                  {' '}
                  Vol.
                </p>
              </div>

              <div
                className={cn(
                  `
                    grid w-full items-stretch gap-2
                    sm:ml-auto sm:flex sm:w-auto sm:flex-none sm:flex-wrap sm:justify-end
                  `,
                  resolveMoneylineButtonGridClass(entry.buttons.length),
                )}
              >
                {entry.buttons.map((button) => {
                  const isActive = activeTradeButtonKey === button.key || selectedButtonKey === button.key
                  const hasTeamColor = button.tone === 'team1' || button.tone === 'team2'
                  const buttonOverlayStyle = hasTeamColor
                    ? resolveButtonOverlayStyle(button.color, button.tone)
                    : undefined

                  return (
                    <div
                      key={`${entry.key}-${button.key}`}
                      className="relative w-full min-w-0 overflow-hidden rounded-lg pb-1.25 sm:w-[118px] sm:shrink-0"
                    >
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg',
                          !hasTeamColor && 'bg-border/70',
                        )}
                        style={hasTeamColor ? resolveButtonDepthStyle(button.color, button.tone) : undefined}
                      />
                      <button
                        type="button"
                        data-sports-card-control="true"
                        onClick={() => {
                          updateAuxiliarySelection(entry.key, button.key, {
                            panelMode: isResolved ? 'preserve' : (isMobile ? 'full' : 'partial'),
                          })
                        }}
                        style={hasTeamColor ? resolveButtonStyle(button.color, button.tone) : undefined}
                        className={cn(
                          `
                            relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg px-2 text-xs
                            font-semibold shadow-sm transition-transform duration-150 ease-out
                            hover:translate-y-px
                            active:translate-y-0.5
                          `,
                          !hasTeamColor && 'bg-secondary text-secondary-foreground hover:bg-accent',
                        )}
                      >
                        {buttonOverlayStyle
                          ? <span className="pointer-events-none absolute inset-0 rounded-lg" style={buttonOverlayStyle} />
                          : null}
                        <span className={cn('relative z-1 mr-1 uppercase', isActive ? 'opacity-80' : 'opacity-70')}>
                          {button.label}
                        </span>
                        <span className="relative z-1 text-sm leading-none tabular-nums">
                          {formatButtonOdds(buttonPriceCentsByKey.get(button.key) ?? button.cents)}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {seriesPreviewSegmentWinnerPanels.length > 1 && (
              <SportsSegmentNumberPicker
                options={seriesWinnerSegmentPickerOptions}
                activeNumber={entry.mapNumber}
                segmentLabel={segmentLabel}
                onPick={handlePickSeriesPreviewSegmentNumber}
              />
            )}
          </article>
        )
      })()
    : null
  const marketPanelsContent = usesSectionLayout
    ? (
        <div key={activeMarketView?.key ?? 'gameLines'}>
          {!hasEsportsSegmentedLayout && (
            <div className="mb-4 overflow-hidden rounded-xl border bg-card px-2.5">
              <SportsGameDetailsPanel
                card={activeCard}
                activeDetailsTab="orderBook"
                selectedButtonKey={moneylineButtonKey}
                showBottomContent={false}
                defaultGraphTimeRange="ALL"
                allowedConditionIds={allCardConditionIds}
                positionsTitle="All Positions"
                showRedeemInPositions
                onOpenRedeemForCondition={handleOpenRedeemForCondition}
                oddsFormat={oddsFormat}
                onChangeTab={() => {}}
                onSelectButton={(buttonKey, options) => {
                  updateSectionSelection('moneyline', buttonKey, options)
                }}
              />
            </div>
          )}

          <div className="space-y-4">
            {availableSections.map((section) => {
              const usesSeriesSegmentNumberPicker = hasEsportsSegmentedLayout
                && activeEsportsSegmentTabKey === 'series'
                && section.key === 'spread'
                && seriesSpreadSegmentPickerOptions.length > 1
              const usesSeriesTotalLinePicker = hasEsportsSegmentedLayout
                && activeEsportsSegmentTabKey === 'series'
                && section.key === 'total'
                && seriesTotalPickerOptions.length > 1
              const sectionButtons = resolveSectionButtons(
                section.key,
                usesSeriesSegmentNumberPicker
                  ? activeSeriesSpreadConditionId
                  : usesSeriesTotalLinePicker
                    ? activeSeriesTotalConditionId
                    : null,
              )
              if (sectionButtons.length === 0) {
                return null
              }

              const selectedButtonKey = usesSeriesSegmentNumberPicker
                ? (resolveSeriesSpreadSelectedButtonKey() ?? sectionButtons[0]?.key ?? null)
                : usesSeriesTotalLinePicker
                  ? (resolveSeriesTotalSelectedButtonKey() ?? sectionButtons[0]?.key ?? null)
                  : (selectedButtonBySection[section.key] ?? sectionButtons[0]?.key ?? null)
              const isSectionOpen = openSectionKey === section.key
              const sectionConditionIds = sectionConditionIdsByKey[section.key]
              const activeTab = tabBySection[section.key] ?? 'orderBook'
              const selectedSectionButton = resolveSelectedButton(activeCard, selectedButtonKey)
              const selectedSectionConditionId = selectedSectionButton?.conditionId ?? sectionButtons[0]?.conditionId ?? null
              const isSectionResolved = sectionResolvedByKey[section.key]
              const sectionClaimGroups = claimGroupsBySection[section.key]
              const shouldShowRedeemButton = isSectionResolved && sectionClaimGroups.length > 0
              const sectionTitle = isHalftimeResultView && section.key === 'moneyline'
                ? 'Halftime Result'
                : hasEsportsSegmentedLayout && activeEsportsSegmentTabKey === 'series' && section.key === 'spread'
                  ? `${segmentLabel} Handicap`
                  : hasEsportsSegmentedLayout && activeEsportsSegmentTabKey === 'series' && section.key === 'total'
                    ? `Total ${segmentPluralLabel}`
                    : section.label
              const shouldUseClosedLinePickerSpacing = (
                !isSectionResolved
                && !isSectionOpen
                && !(
                  hasEsportsSegmentedLayout
                  && activeEsportsSegmentTabKey === 'series'
                  && (section.key === 'spread' || section.key === 'total')
                )
                && (selectedSectionButton?.marketType === 'spread' || selectedSectionButton?.marketType === 'total')
                && sectionConditionIds.size > 1
              )
              const sectionDetailConditionIds = (usesSeriesSegmentNumberPicker || usesSeriesTotalLinePicker)
                ? new Set(selectedSectionConditionId ? [selectedSectionConditionId] : [])
                : sectionConditionIds
              const firstSectionButtonKey = sectionButtons[0]?.key ?? null

              function toggleSection() {
                setOpenSectionKey(current => current === section.key ? null : section.key)
              }

              function handleCardClick(event: React.MouseEvent<HTMLElement>) {
                const target = event.target as HTMLElement
                if (target.closest('[data-sports-card-control="true"]')) {
                  return
                }
                if (firstSectionButtonKey) {
                  updateSectionSelection(section.key, firstSectionButtonKey, { panelMode: 'preserve' })
                }
                toggleSection()
              }

              function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                const target = event.target as HTMLElement
                if (target.closest('[data-sports-card-control="true"]')) {
                  return
                }
                event.preventDefault()
                if (firstSectionButtonKey) {
                  updateSectionSelection(section.key, firstSectionButtonKey, { panelMode: 'preserve' })
                }
                toggleSection()
              }

              return (
                <div key={`${activeCard.id}-${section.key}`} className="space-y-4">
                  <article
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <div
                      className={cn(
                        `
                          flex w-full cursor-pointer flex-col items-stretch gap-3 px-4 py-[18px] transition-colors
                          sm:flex-row sm:items-center
                        `,
                        'hover:bg-secondary/30',
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={handleCardClick}
                      onKeyDown={handleCardKeyDown}
                    >
                      <div className="min-w-0 text-left transition-colors hover:text-foreground/90">
                        <h3 className="text-sm font-semibold text-foreground">{sectionTitle}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          {formatVolume(sectionVolumes[section.key])}
                          {' '}
                          Vol.
                        </p>
                      </div>

                      {!isSectionResolved && (
                        <div
                          className={cn(
                            'grid w-full min-w-0 items-stretch gap-2',
                            'sm:ml-auto sm:flex-none',
                            section.key === 'moneyline'
                              ? 'sm:w-[372px]'
                              : 'grid-cols-2 sm:w-[248px] sm:grid-cols-2',
                          )}
                        >
                          {section.key === 'moneyline'
                            ? (
                                <div
                                  className={cn(
                                    'grid w-full items-stretch gap-2 sm:flex sm:flex-wrap sm:justify-end',
                                    resolveMoneylineButtonGridClass(sectionButtons.length),
                                  )}
                                >
                                  {sectionButtons.map((button) => {
                                    const isActive = activeTradeButtonKey === button.key
                                    const hasTeamColor = (button.tone === 'team1' || button.tone === 'team2')
                                      && (button.marketType === 'moneyline' || isActive)
                                    const isOverButton = isActive && button.tone === 'over'
                                    const isUnderButton = isActive && button.tone === 'under'
                                    const buttonOverlayStyle = hasTeamColor
                                      ? resolveButtonOverlayStyle(button.color, button.tone)
                                      : undefined

                                    return (
                                      <div
                                        key={`${section.key}-${button.key}`}
                                        className="
                                          relative w-full min-w-0 overflow-hidden rounded-lg pb-1.25
                                          sm:w-[118px] sm:shrink-0
                                        "
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
                                            event.stopPropagation()
                                            updateSectionSelection(section.key, button.key, { panelMode: 'full' })
                                          }}
                                          style={hasTeamColor ? resolveButtonStyle(button.color, button.tone) : undefined}
                                          className={cn(
                                            `
                                              relative flex h-9 w-full translate-y-0 items-center justify-center
                                              rounded-lg px-2 text-xs font-semibold shadow-sm transition-transform
                                              duration-150 ease-out
                                              hover:translate-y-px
                                              active:translate-y-0.5
                                            `,
                                            !hasTeamColor && !isOverButton && !isUnderButton
                                            && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                            isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                            isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                                          )}
                                        >
                                          {buttonOverlayStyle
                                            ? <span className="pointer-events-none absolute inset-0 rounded-lg" style={buttonOverlayStyle} />
                                            : null}
                                          <span className="relative z-1 mr-1 uppercase opacity-80">{button.label}</span>
                                          <span className={cn(
                                            'relative z-1 text-sm leading-none tabular-nums transition-opacity',
                                            isActive ? 'opacity-100' : 'opacity-45',
                                          )}
                                          >
                                            {formatButtonOdds(buttonPriceCentsByKey.get(button.key) ?? button.cents)}
                                          </span>
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            : sectionButtons.map((button) => {
                                const isActive = activeTradeButtonKey === button.key
                                const hasTeamColor = (button.tone === 'team1' || button.tone === 'team2')
                                  && (button.marketType === 'moneyline' || isActive)
                                const isOverButton = isActive && button.tone === 'over'
                                const isUnderButton = isActive && button.tone === 'under'
                                const buttonOverlayStyle = hasTeamColor
                                  ? resolveButtonOverlayStyle(button.color, button.tone)
                                  : undefined

                                return (
                                  <div
                                    key={`${section.key}-${button.key}`}
                                    className="relative min-w-0 overflow-hidden rounded-lg pb-1.25"
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
                                        event.stopPropagation()
                                        updateSectionSelection(section.key, button.key, { panelMode: 'full' })
                                      }}
                                      style={hasTeamColor ? resolveButtonStyle(button.color, button.tone) : undefined}
                                      className={cn(
                                        `
                                          relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg
                                          px-2 text-xs font-semibold shadow-sm transition-transform duration-150
                                          ease-out
                                          hover:translate-y-px
                                          active:translate-y-0.5
                                        `,
                                        !hasTeamColor && !isOverButton && !isUnderButton
                                        && 'bg-secondary text-secondary-foreground hover:bg-accent',
                                        isOverButton && 'bg-yes text-white hover:bg-yes-foreground',
                                        isUnderButton && 'bg-no text-white hover:bg-no-foreground',
                                      )}
                                    >
                                      {buttonOverlayStyle
                                        ? <span className="pointer-events-none absolute inset-0 rounded-lg" style={buttonOverlayStyle} />
                                        : null}
                                      <span className="relative z-1 flex w-full items-center justify-between gap-1 px-1">
                                        <span className="min-w-0 truncate text-left uppercase opacity-80">
                                          {button.label}
                                        </span>
                                        <span className="shrink-0 text-sm leading-none tabular-nums">
                                          {formatButtonOdds(buttonPriceCentsByKey.get(button.key) ?? button.cents)}
                                        </span>
                                      </span>
                                    </button>
                                  </div>
                                )
                              })}
                        </div>
                      )}

                      {shouldShowRedeemButton && (
                        <div
                          className="
                            min-w-0 flex-1
                            min-[1200px]:ml-auto min-[1200px]:w-[calc((372px-1rem)/3)] min-[1200px]:flex-none
                          "
                        >
                          <div className="relative min-w-0 overflow-hidden rounded-lg pb-1.25">
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg bg-primary" />
                            <button
                              type="button"
                              data-sports-card-control="true"
                              onClick={(event) => {
                                event.stopPropagation()
                                const sectionDefaultConditionId = selectedSectionButton?.conditionId
                                  ?? sectionClaimGroups[0]?.conditionId
                                  ?? null
                                setRedeemDefaultConditionId(sectionDefaultConditionId)
                                setRedeemSectionKey(section.key)
                              }}
                              className={`
                                relative flex h-9 w-full translate-y-0 items-center justify-center rounded-lg bg-primary
                                px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-transform
                                duration-150 ease-out
                                hover:translate-y-px hover:bg-primary
                                active:translate-y-0.5
                              `}
                            >
                              Redeem
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {usesSeriesSegmentNumberPicker && (
                      <SportsSegmentNumberPicker
                        options={seriesSpreadSegmentPickerOptions}
                        activeNumber={activeSeriesSpreadSegmentNumber}
                        segmentLabel={segmentLabel}
                        onPick={handlePickSeriesSpreadSegmentNumber}
                      />
                    )}

                    {usesSeriesTotalLinePicker && (
                      <SportsSegmentNumberPicker
                        options={seriesTotalPickerOptions}
                        activeNumber={activeSeriesTotalLineValue}
                        segmentLabel="Line"
                        onPick={handlePickSeriesTotalLineValue}
                      />
                    )}

                    <div
                      className={cn(
                        'bg-card px-2.5',
                        isSectionOpen
                          ? 'border-t pt-3'
                          : shouldUseClosedLinePickerSpacing
                            ? 'pt-3'
                            : 'pt-0',
                      )}
                    >
                      <SportsGameDetailsPanel
                        card={activeCard}
                        activeDetailsTab={activeTab}
                        selectedButtonKey={selectedButtonKey}
                        showBottomContent={isSectionOpen}
                        defaultGraphTimeRange="ALL"
                        allowedConditionIds={sectionDetailConditionIds}
                        showAboutTab
                        aboutEvent={activeCard.event}
                        rulesEvent={heroCard.event}
                        marketContextEnabled={marketContextEnabled}
                        oddsFormat={oddsFormat}
                        onChangeTab={tab => setTabBySection(current => ({ ...current, [section.key]: tab }))}
                        onSelectButton={(buttonKey, options) => {
                          updateSectionSelection(section.key, buttonKey, options)
                        }}
                      />
                    </div>
                  </article>

                  {section.key === 'moneyline' ? seriesPreviewSegmentWinnerCard : null}
                </div>
              )
            })}
          </div>

          {nonSectionAuxiliaryMarketPanels.length > 0 && (
            <div className="mt-4 space-y-4">
              {nonSectionAuxiliaryMarketPanels}
            </div>
          )}
        </div>
      )
    : (
        <div key={activeMarketView?.key ?? 'gameLines'} className="space-y-4">
          {auxiliaryMarketPanels}
        </div>
      )

  return (
    <>
      <Suspense fallback={null}>
        <SportsEventQuerySync onSelectionChange={handleQuerySelectionChange} />
      </Suspense>
      <div className="
        min-[1200px]:grid min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem]
        min-[1200px]:[align-content:start] min-[1200px]:[align-items:start] min-[1200px]:gap-6
      "
      >
        <section
          data-sports-scroll-pane="center"
          className="
            min-w-0
            min-[1200px]:min-h-0 min-[1200px]:self-stretch min-[1200px]:overflow-y-auto min-[1200px]:overscroll-contain
            min-[1200px]:pr-1
            lg:ml-4
          "
        >
          <div className="mb-4">
            <div className="relative mb-1 flex min-h-9 items-center justify-center">
              <AppLink
                href={`${verticalConfig.basePath}/${sportSlug}/games`}
                aria-label="Back to games"
                className={cn(
                  headerIconButtonClass,
                  'absolute left-0 inline-flex size-8 items-center justify-center p-0 text-foreground md:size-9',
                )}
              >
                <ChevronLeftIcon className="size-4 text-foreground" />
              </AppLink>

              <div
                className="
                  flex min-w-0 items-center justify-center gap-1 px-14 text-center text-sm text-muted-foreground
                  sm:px-22
                "
              >
                <AppLink href={verticalConfig.livePath} className="hover:text-foreground">
                  {verticalConfig.label}
                </AppLink>
                <span className="opacity-60">·</span>
                <AppLink
                  href={`${verticalConfig.basePath}/${sportSlug}/games`}
                  className="truncate hover:text-foreground"
                >
                  {sportLabel}
                </AppLink>
              </div>

              <div className="absolute right-0 flex items-center gap-1 text-foreground">
                <EventBookmark event={heroCard.event} />
                <SportsEventShareButton event={heroCard.event} />
              </div>
            </div>

            <h1 className="text-center text-xl font-semibold text-foreground sm:text-2xl">
              {eventTitle}
            </h1>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/70" />
            <div className="pointer-events-none flex items-center gap-2 text-sm text-muted-foreground select-none">
              <SiteLogoIcon
                logoSvg={site.logoSvg}
                logoImageUrl={site.logoImageUrl}
                alt={`${site.name} logo`}
                className="
                  pointer-events-none size-4 text-current select-none
                  [&_svg]:size-4
                  [&_svg_*]:fill-current [&_svg_*]:stroke-current
                "
                imageClassName="pointer-events-none size-4 object-contain select-none"
                size={16}
              />
              <span className="font-medium select-none">{site.name}</span>
            </div>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          {canWatchLivestream && (
            <div className="mb-4 flex items-center justify-center">
              <button
                type="button"
                onClick={() => openLivestream({
                  url: heroCard.event.livestream_url!,
                  title: heroCard.event.title || heroCard.title,
                })}
                className={`
                  inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/80 bg-background px-3
                  py-1.5 text-xs font-medium text-muted-foreground transition-colors
                  hover:bg-secondary/50 hover:text-foreground
                `}
              >
                <SportsEventLiveStatusIcon
                  className="size-3.5"
                  muted={isCurrentEventLivestreamOpen}
                />
                <span>Watch Stream</span>
              </button>
            </div>
          )}

          <div className="mb-4 flex items-center justify-center gap-12 md:gap-14">
            <div className={cn('flex flex-col items-center gap-2', useFullCompetitorHeroLabels ? 'w-24 sm:w-28' : 'w-20')}>
              <div
                className={cn(
                  'pointer-events-none flex items-center justify-center select-none',
                  useCroppedHeroTeamLogo ? 'relative size-12 overflow-hidden rounded-lg' : 'size-12',
                )}
              >
                {team1?.logoUrl
                  ? (
                      useCroppedHeroTeamLogo
                        ? (
                            <Image
                              src={team1.logoUrl}
                              alt={`${team1.name} logo`}
                              fill
                              sizes="48px"
                              draggable={false}
                              className="scale-[1.12] object-cover object-center select-none"
                            />
                          )
                        : (
                            <Image
                              src={team1.logoUrl}
                              alt={`${team1.name} logo`}
                              width={48}
                              height={48}
                              sizes="48px"
                              draggable={false}
                              className="size-full object-contain object-center select-none"
                            />
                          )
                    )
                  : (
                      <div
                        className={cn(
                          'text-sm font-semibold text-muted-foreground',
                          useCroppedHeroTeamLogo
                          && `
                            flex size-full items-center justify-center rounded-lg border border-border/40 bg-secondary
                          `,
                        )}
                      >
                        {team1?.abbreviation ?? '—'}
                      </div>
                    )}
              </div>
              <span
                className={cn(
                  'text-center font-semibold text-foreground',
                  useFullCompetitorHeroLabels
                    ? 'max-w-full text-xs/tight sm:text-sm'
                    : 'text-base uppercase',
                )}
              >
                {heroTeam1Label}
              </span>
            </div>

            {showFinalScore || showLiveScore
              ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-3xl leading-none font-semibold tabular-nums">
                      <span
                        className={team1Won
                          ? 'text-foreground'
                          : team2Won
                            ? 'text-muted-foreground'
                            : 'text-foreground'}
                      >
                        {team1Score ?? '—'}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span
                        className={team2Won
                          ? 'text-foreground'
                          : team1Won
                            ? 'text-muted-foreground'
                            : 'text-foreground'}
                      >
                        {team2Score ?? '—'}
                      </span>
                    </div>
                    {showFinalScore
                      ? (
                          <span className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            FINAL
                          </span>
                        )
                      : (
                          <span className="mt-1 text-xs font-semibold tracking-wide text-red-500 uppercase">
                            LIVE
                          </span>
                        )}
                  </div>
                )
              : (
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-foreground">{timeLabel}</span>
                    <span className="text-sm font-medium text-muted-foreground">{dayLabel}</span>
                  </div>
                )}

            <div className={cn('flex flex-col items-center gap-2', useFullCompetitorHeroLabels ? 'w-24 sm:w-28' : 'w-20')}>
              <div
                className={cn(
                  'pointer-events-none flex items-center justify-center select-none',
                  useCroppedHeroTeamLogo ? 'relative size-12 overflow-hidden rounded-lg' : 'size-12',
                )}
              >
                {team2?.logoUrl
                  ? (
                      useCroppedHeroTeamLogo
                        ? (
                            <Image
                              src={team2.logoUrl}
                              alt={`${team2.name} logo`}
                              fill
                              sizes="48px"
                              draggable={false}
                              className="scale-[1.12] object-cover object-center select-none"
                            />
                          )
                        : (
                            <Image
                              src={team2.logoUrl}
                              alt={`${team2.name} logo`}
                              width={48}
                              height={48}
                              sizes="48px"
                              draggable={false}
                              className="size-full object-contain object-center select-none"
                            />
                          )
                    )
                  : (
                      <div
                        className={cn(
                          'text-sm font-semibold text-muted-foreground',
                          useCroppedHeroTeamLogo
                          && `
                            flex size-full items-center justify-center rounded-lg border border-border/40 bg-secondary
                          `,
                        )}
                      >
                        {team2?.abbreviation ?? '—'}
                      </div>
                    )}
              </div>
              <span
                className={cn(
                  'text-center font-semibold text-foreground',
                  useFullCompetitorHeroLabels
                    ? 'max-w-full text-xs/tight sm:text-sm'
                    : 'text-base uppercase',
                )}
              >
                {heroTeam2Label}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-muted-foreground">
                {formatVolume(heroCard.volume)}
                {' '}
                Vol.
              </span>
              <div className="pointer-events-none flex items-center gap-2 text-muted-foreground select-none">
                <SiteLogoIcon
                  logoSvg={site.logoSvg}
                  logoImageUrl={site.logoImageUrl}
                  alt={`${site.name} logo`}
                  className="
                    pointer-events-none size-4 text-current select-none
                    [&_svg]:size-4
                    [&_svg_*]:fill-current [&_svg_*]:stroke-current
                  "
                  imageClassName="pointer-events-none size-4 object-contain select-none"
                  size={16}
                />
                <span className="text-base font-semibold select-none">{site.name}</span>
              </div>
            </div>
            <SportsGameGraph
              card={heroCard}
              selectedMarketType="moneyline"
              selectedConditionId={graphConditionId}
              defaultTimeRange="ALL"
              variant="sportsEventHero"
            />
          </div>

          {marketViewTabs}
          {esportsEventTabs}
          {marketPanelsContent}

          <div className="mt-6 grid gap-6">
            <SportsEventAboutPanel
              event={activeCard.event}
              rulesEvent={heroCard.event}
              market={pageAboutMarket}
              marketContextEnabled={marketContextEnabled}
              mode="page"
            />
            <EventTabs event={heroCard.event} user={user ?? null} />
          </div>
        </section>

        <aside
          data-sports-scroll-pane="aside"
          className={`
            hidden gap-4
            min-[1200px]:sticky min-[1200px]:top-0 min-[1200px]:block min-[1200px]:h-fit min-[1200px]:max-h-full
            min-[1200px]:self-start min-[1200px]:overflow-y-auto
          `}
        >
          {activeTradeContext
            ? (
                <div className="grid gap-6">
                  <EventOrderPanelForm
                    isMobile={false}
                    event={activeCard.event}
                    oddsFormat={oddsFormat}
                    outcomeButtonStyleVariant="sports3d"
                    optimisticallyClaimedConditionIds={claimedConditionIds}
                    outcomeLabelOverrides={orderPanelOutcomeLabelOverrides}
                    outcomeAccentOverrides={orderPanelOutcomeAccentOverrides}
                    desktopMarketInfo={(
                      <SportsOrderPanelMarketInfo
                        card={activeCard}
                        selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
                        selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
                        marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
                      />
                    )}
                    primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
                  />
                  <EventOrderPanelTermsDisclaimer />
                  <SportsEventRelatedGames
                    cards={relatedCards}
                    sportSlug={sportSlug}
                    sportLabel={sportLabel}
                    locale={locale}
                    vertical={vertical}
                  />
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
          event={activeCard.event}
          showDefaultTrigger={false}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant="sports3d"
          optimisticallyClaimedConditionIds={claimedConditionIds}
          outcomeLabelOverrides={orderPanelOutcomeLabelOverrides}
          outcomeAccentOverrides={orderPanelOutcomeAccentOverrides}
          mobileMarketInfo={(
            <SportsOrderPanelMarketInfo
              card={activeCard}
              selectedButton={activeTradeHeaderContext?.button ?? activeTradeContext.button}
              selectedOutcome={activeTradeHeaderContext?.outcome ?? activeTradeContext.outcome}
              marketType={activeTradeHeaderContext?.button.marketType ?? activeTradeContext.button.marketType}
            />
          )}
          primaryOutcomeIndex={activeTradePrimaryOutcomeIndex}
        />
      )}

      {redeemSectionConfig && (
        <SportsRedeemModal
          open={Boolean(redeemSectionConfig)}
          onOpenChange={(open) => {
            if (!open) {
              setRedeemSectionKey(null)
              setRedeemDefaultConditionId(null)
            }
          }}
          title="Cash out"
          subtitle={eventShortLabel}
          sections={redeemModalSections}
          defaultSelectedSectionKey={redeemSectionKey}
          defaultSelectedConditionId={redeemDefaultConditionId}
          onClaimSuccess={(conditionIds) => {
            setClaimedConditionIds((current) => {
              const next = { ...current }
              conditionIds.forEach((conditionId) => {
                next[conditionId] = true
              })
              return next
            })
          }}
        />
      )}

      <SportsLivestreamFloatingPlayer />
    </>
  )
}
