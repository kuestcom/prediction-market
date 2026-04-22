import type {
  DetailsTab,
  SportsActiveTradeContext,
  SportsTradeSelection,
} from './sports-games-center-types'
import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { OddsFormat } from '@/lib/odds-format'
import type { Event, Market, Outcome } from '@/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import {
  isSportsGamesCardResolved,
  resolveSportsGamesCardVisibleMarketTypes,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { resolveOutcomePriceCents, resolveOutcomeSelectionPriceCents } from '@/lib/market-pricing'
import { formatOddsFromCents } from '@/lib/odds-format'
import { useOrder } from '@/stores/useOrder'
import {
  SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY,
  SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY,
} from './sports-games-center-constants'
import {
  isCardFuture,
  isCardLiveNow,
  normalizeComparableText,
  resolveCardCategoryLabel,
  resolveCardStartTimestamp,
  resolveDefaultConditionId,
  resolveInitialShowSpreadsAndTotals,
  resolveInitialSportsEventOddsFormat,
  resolveOrderPanelOutcomeAccentOverrides,
  resolveOrderPanelOutcomeLabelOverrides,
  resolveSelectedButton,
  resolveSelectedMarket,
  resolveSelectedOutcome,
  resolveStableSpreadPrimaryOutcomeIndex,
  toDateGroupKey,
} from './sports-games-center-utils'

export function useSportsGamesCenterShellState() {
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [isDetailsContentVisible, setIsDetailsContentVisible] = useState(true)
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTab>('orderBook')
  const [selectedConditionByCardId, setSelectedConditionByCardId] = useState<Record<string, string>>({})
  const [tradeSelection, setTradeSelection] = useState<SportsTradeSelection>({ cardId: null, buttonKey: null })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>(() => resolveInitialSportsEventOddsFormat())
  const [showSpreadsAndTotals, setShowSpreadsAndTotals] = useState(() => resolveInitialShowSpreadsAndTotals())
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  return {
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
  }
}

export function useCategoryResolver(categoryTitleBySlug: Record<string, string>) {
  const normalizedCategoryTitleBySlug = useMemo(() => {
    return Object.fromEntries(
      Object.entries(categoryTitleBySlug).map(([slug, title]) => [slug.trim().toLowerCase(), title]),
    )
  }, [categoryTitleBySlug])
  const resolveCardCategory = useCallback(
    (card: SportsGamesCard) => resolveCardCategoryLabel(card, normalizedCategoryTitleBySlug),
    [normalizedCategoryTitleBySlug],
  )

  return { resolveCardCategory }
}

export function useOddsFormatAndSpreadsTotalsPersistence({
  oddsFormat,
  showSpreadsAndTotals,
}: {
  oddsFormat: OddsFormat
  showSpreadsAndTotals: boolean
}) {
  useEffect(function persistOddsFormatAndSpreadsTotals() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY, oddsFormat)
      window.localStorage.setItem(
        SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY,
        showSpreadsAndTotals ? '1' : '0',
      )
    }

    return undefined
  }, [oddsFormat, showSpreadsAndTotals])
}

export function useResetMobileOrderPanelOnDeviceChange({
  isMobile,
  setIsMobileOrderPanelOpen,
}: {
  isMobile: boolean
  setIsMobileOrderPanelOpen: (open: boolean) => void
}) {
  useEffect(function resetMobileOrderPanelOnDeviceChange() {
    if (!isMobile) {
      return undefined
    }

    // Avoid carrying over an open trade drawer while browsing cards on mobile.
    setIsMobileOrderPanelOpen(false)
    return undefined
  }, [isMobile, setIsMobileOrderPanelOpen])
}

export function useSportsGamesButtonOddsFormatter(oddsFormat: OddsFormat) {
  const formatButtonOdds = useCallback((cents: number) => {
    if (oddsFormat === 'price') {
      return `${cents}¢`
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])

  return { formatButtonOdds }
}

export function useResolveDisplayButtonKey(showSpreadsAndTotals: boolean) {
  const resolveDisplayButtonKey = useCallback((
    card: SportsGamesCard,
    preferredKey: string | null | undefined,
  ) => {
    const preferredButton = preferredKey
      ? card.buttons.find(button => button.key === preferredKey) ?? null
      : null
    const visibleMarketTypes = new Set(resolveSportsGamesCardVisibleMarketTypes(card, showSpreadsAndTotals))
    if (preferredButton && visibleMarketTypes.has(preferredButton.marketType)) {
      return preferredButton.key
    }

    return card.buttons.find(button => visibleMarketTypes.has(button.marketType))?.key
      ?? preferredButton?.key
      ?? resolveDefaultConditionId(card)
  }, [showSpreadsAndTotals])

  return { resolveDisplayButtonKey }
}

export function useVisiblePageCards({
  cards,
  isFeedPage,
  isLivePage,
  isSoonPage,
  currentTimestampMs,
}: {
  cards: SportsGamesCard[]
  isFeedPage: boolean
  isLivePage: boolean
  isSoonPage: boolean
  currentTimestampMs: number
}) {
  const visibleCards = useMemo(() => {
    if (isFeedPage) {
      return cards
    }

    return cards.filter(card => !isSportsGamesCardResolved(card))
  }, [cards, isFeedPage])

  const pageCards = useMemo(() => {
    if (isLivePage) {
      return visibleCards.filter(card => isCardLiveNow(card, currentTimestampMs))
    }

    if (isSoonPage) {
      return visibleCards.filter(card => isCardFuture(card, currentTimestampMs))
    }

    return visibleCards
  }, [currentTimestampMs, isLivePage, isSoonPage, visibleCards])

  return { visibleCards, pageCards }
}

export function useWeekFilterState({
  initialWeek,
  isFeedPage,
  visibleCards,
  pageCards,
}: {
  initialWeek: number | null
  isFeedPage: boolean
  visibleCards: SportsGamesCard[]
  pageCards: SportsGamesCard[]
}) {
  const weekOptions = useMemo(() => {
    if (isFeedPage) {
      return []
    }

    const weeks = Array.from(new Set(
      visibleCards
        .map(card => card.week)
        .filter((week): week is number => Number.isFinite(week)),
    ))

    return weeks.sort((a, b) => a - b)
  }, [isFeedPage, visibleCards])

  const requestedWeekOption = useMemo(() => {
    if (isFeedPage || initialWeek == null || !Number.isFinite(initialWeek)) {
      return null
    }
    return String(initialWeek)
  }, [initialWeek, isFeedPage])

  const latestWeekOption = useMemo(
    () => (weekOptions.length > 0 ? String(weekOptions.at(-1)) : 'all'),
    [weekOptions],
  )

  const [selectedWeek, setSelectedWeek] = useState<string>(
    requestedWeekOption
    ?? latestWeekOption,
  )

  const effectiveSelectedWeek = useMemo(() => {
    if (isFeedPage || weekOptions.length === 0) {
      return 'all'
    }

    if (selectedWeek !== 'all') {
      for (const week of weekOptions) {
        if (String(week) === selectedWeek) {
          return selectedWeek
        }
      }
    }

    if (requestedWeekOption != null) {
      for (const week of weekOptions) {
        if (String(week) === requestedWeekOption) {
          return requestedWeekOption
        }
      }
    }

    return latestWeekOption
  }, [isFeedPage, latestWeekOption, requestedWeekOption, selectedWeek, weekOptions])

  const weekFilteredCards = useMemo(() => {
    if (isFeedPage) {
      return pageCards
    }

    if (effectiveSelectedWeek === 'all') {
      return visibleCards
    }

    const week = Number(effectiveSelectedWeek)
    return visibleCards.filter(card => card.week === week)
  }, [effectiveSelectedWeek, isFeedPage, pageCards, visibleCards])

  return {
    weekOptions,
    effectiveSelectedWeek,
    setSelectedWeek,
    weekFilteredCards,
  }
}

export function useSearchAutoFocus({
  isSearchOpen,
  searchInputRef,
}: {
  isSearchOpen: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
}) {
  useEffect(function focusSearchInputWhenSearchOpens() {
    if (!isSearchOpen) {
      return undefined
    }
    searchInputRef.current?.focus()
    return undefined
  }, [isSearchOpen, searchInputRef])
}

export function useSearchOutsidePointerClose({
  isSearchOpen,
  searchQuery,
  searchShellRef,
  setIsSearchOpen,
}: {
  isSearchOpen: boolean
  searchQuery: string
  searchShellRef: React.RefObject<HTMLDivElement | null>
  setIsSearchOpen: (open: boolean) => void
}) {
  useEffect(function closeSearchOnOutsidePointerDown() {
    if (!isSearchOpen) {
      return undefined
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (searchShellRef.current?.contains(target)) {
        return
      }
      if (searchQuery.trim()) {
        return
      }
      setIsSearchOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return function removeSearchPointerDownListener() {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isSearchOpen, searchQuery, searchShellRef, setIsSearchOpen])
}

export function useSportsSearchFilteredCards({
  weekFilteredCards,
  searchQuery,
  resolveCardCategory,
}: {
  weekFilteredCards: SportsGamesCard[]
  searchQuery: string
  resolveCardCategory: (card: SportsGamesCard) => string
}) {
  const normalizedSearchQuery = useMemo(
    () => normalizeComparableText(searchQuery),
    [searchQuery],
  )

  const filteredCards = useMemo(() => {
    if (!normalizedSearchQuery) {
      return weekFilteredCards
    }

    return weekFilteredCards.filter((card) => {
      const searchableText = [
        card.title,
        card.event.title,
        card.event.slug,
        resolveCardCategory(card),
        ...(card.event.sports_tags ?? []),
        ...card.teams.flatMap(team => [team.name, team.abbreviation]),
      ]
        .map(value => normalizeComparableText(value))
        .join(' ')

      return searchableText.includes(normalizedSearchQuery)
    })
  }, [normalizedSearchQuery, resolveCardCategory, weekFilteredCards])

  return { normalizedSearchQuery, filteredCards }
}

export function useCardButtonPriceMap(filteredCards: SportsGamesCard[]) {
  const buttonTokenIds = useMemo(() => {
    const tokenIds = new Set<string>()

    filteredCards.forEach((card) => {
      const marketsByConditionId = new Map(
        card.detailMarkets.map(market => [market.condition_id, market] as const),
      )

      card.buttons.forEach((button) => {
        const market = marketsByConditionId.get(button.conditionId)
        const outcome = market?.outcomes.find(currentOutcome => currentOutcome.outcome_index === button.outcomeIndex)
          ?? market?.outcomes[button.outcomeIndex]

        if (outcome?.token_id) {
          tokenIds.add(String(outcome.token_id))
        }
      })
    })

    return Array.from(tokenIds)
  }, [filteredCards])
  const { data: buttonOrderBookSummaries } = useOrderBookSummaries(buttonTokenIds)
  const buttonPriceCentsByKey = useMemo(() => {
    const priceByKey = new Map<string, number>()

    filteredCards.forEach((card) => {
      const marketsByConditionId = new Map(
        card.detailMarkets.map(market => [market.condition_id, market] as const),
      )

      card.buttons.forEach((button) => {
        const market = marketsByConditionId.get(button.conditionId) ?? null
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
        priceByKey.set(`${card.id}:${button.key}`, selectionCents ?? cents ?? button.cents)
      })
    })

    return priceByKey
  }, [buttonOrderBookSummaries, filteredCards])

  return { buttonPriceCentsByKey }
}

export function useEffectiveOpenAndTradeSelection({
  openCardId,
  filteredCards,
  tradeSelection,
  selectedConditionByCardId,
  showSpreadsAndTotals,
  resolveDisplayButtonKey,
}: {
  openCardId: string | null
  filteredCards: SportsGamesCard[]
  tradeSelection: SportsTradeSelection
  selectedConditionByCardId: Record<string, string>
  showSpreadsAndTotals: boolean
  resolveDisplayButtonKey: (card: SportsGamesCard, preferredKey: string | null | undefined) => string | null
}) {
  const effectiveOpenCardId = useMemo(() => {
    if (!openCardId) {
      return null
    }

    return filteredCards.some(card => card.id === openCardId) ? openCardId : null
  }, [filteredCards, openCardId])

  const effectiveTradeSelection = useMemo<SportsTradeSelection>(() => {
    if (filteredCards.length === 0) {
      return { cardId: null, buttonKey: null }
    }

    const currentCard = tradeSelection.cardId
      ? filteredCards.find(card => card.id === tradeSelection.cardId) ?? null
      : null

    if (currentCard) {
      const currentButton = tradeSelection.buttonKey
        ? currentCard.buttons.find(button => button.key === tradeSelection.buttonKey) ?? null
        : null
      const currentButtonExists = Boolean(
        currentButton
        && (showSpreadsAndTotals || currentButton.marketType === 'moneyline'),
      )
      if (currentButtonExists) {
        return tradeSelection
      }

      const preferredButtonKey = resolveDisplayButtonKey(
        currentCard,
        selectedConditionByCardId[currentCard.id] ?? resolveDefaultConditionId(currentCard),
      )
      const fallbackButtonKey = resolveSelectedButton(currentCard, preferredButtonKey)?.key ?? null
      return {
        cardId: currentCard.id,
        buttonKey: fallbackButtonKey,
      }
    }

    const firstCard = filteredCards[0]
    const preferredButtonKey = resolveDisplayButtonKey(
      firstCard,
      selectedConditionByCardId[firstCard.id] ?? resolveDefaultConditionId(firstCard),
    )
    const firstButtonKey = resolveSelectedButton(firstCard, preferredButtonKey)?.key ?? null
    return {
      cardId: firstCard.id,
      buttonKey: firstButtonKey,
    }
  }, [filteredCards, resolveDisplayButtonKey, selectedConditionByCardId, showSpreadsAndTotals, tradeSelection])

  return { effectiveOpenCardId, effectiveTradeSelection }
}

export function useLocaleDateTimeFormatters(locale: string) {
  const dateLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    [locale],
  )

  const timeLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
    [locale],
  )

  return { dateLabelFormatter, timeLabelFormatter }
}

export function useCardGroupings({
  filteredCards,
  dateLabelFormatter,
  resolveCardCategory,
  currentTimestampMs,
}: {
  filteredCards: SportsGamesCard[]
  dateLabelFormatter: Intl.DateTimeFormat
  resolveCardCategory: (card: SportsGamesCard) => string
  currentTimestampMs: number
}) {
  const groupedCards = useMemo(() => {
    const grouped = new Map<string, { key: string, label: string, sortValue: number, cards: SportsGamesCard[] }>()

    for (const card of filteredCards) {
      const date = card.startTime ? new Date(card.startTime) : null
      const isValidDate = Boolean(date && !Number.isNaN(date.getTime()))
      const groupKey = isValidDate ? toDateGroupKey(date as Date) : 'tbd'
      const label = isValidDate ? dateLabelFormatter.format(date as Date) : 'Date TBD'
      const sortValue = isValidDate ? (date as Date).getTime() : Number.POSITIVE_INFINITY

      const existing = grouped.get(groupKey)
      if (existing) {
        existing.cards.push(card)
        continue
      }

      grouped.set(groupKey, {
        key: groupKey,
        label,
        sortValue,
        cards: [card],
      })
    }

    return Array.from(grouped.values()).sort((a, b) => a.sortValue - b.sortValue)
  }, [dateLabelFormatter, filteredCards])

  const liveCards = useMemo(
    () => filteredCards.filter(card => isCardLiveNow(card, currentTimestampMs)),
    [currentTimestampMs, filteredCards],
  )

  const liveCardsByCategory = useMemo(() => {
    const grouped = new Map<string, { key: string, label: string, cards: SportsGamesCard[] }>()

    for (const card of liveCards) {
      const label = resolveCardCategory(card)
      const key = normalizeComparableText(label) || card.id
      const existing = grouped.get(key)
      if (existing) {
        existing.cards.push(card)
        continue
      }
      grouped.set(key, {
        key,
        label,
        cards: [card],
      })
    }

    return Array.from(grouped.values())
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [liveCards, resolveCardCategory])

  const sortedFutureCards = useMemo(() => {
    const future = filteredCards.filter(card => isCardFuture(card, currentTimestampMs))

    return [...future].sort((left, right) => {
      const leftStart = resolveCardStartTimestamp(left)
      const rightStart = resolveCardStartTimestamp(right)
      const leftHasStart = Number.isFinite(leftStart)
      const rightHasStart = Number.isFinite(rightStart)

      if (leftHasStart && rightHasStart) {
        return leftStart - rightStart
      }
      if (leftHasStart) {
        return -1
      }
      if (rightHasStart) {
        return 1
      }

      return left.id.localeCompare(right.id)
    })
  }, [currentTimestampMs, filteredCards])

  const startingSoonGroupsByDate = useMemo(() => {
    const groupedByDate = new Map<
      string,
      {
        key: string
        label: string
        sortValue: number
        categories: Map<string, { key: string, label: string, cards: SportsGamesCard[] }>
      }
    >()

    for (const card of sortedFutureCards) {
      const startMs = resolveCardStartTimestamp(card)
      const date = Number.isFinite(startMs) ? new Date(startMs) : null
      const isValidDate = Boolean(date && !Number.isNaN(date.getTime()))
      const dateKey = isValidDate ? toDateGroupKey(date as Date) : 'tbd'
      const dateLabel = isValidDate ? dateLabelFormatter.format(date as Date) : 'Date TBD'
      const sortValue = isValidDate ? (date as Date).getTime() : Number.POSITIVE_INFINITY

      const categoryLabel = resolveCardCategory(card)
      const categoryKey = normalizeComparableText(categoryLabel) || card.id

      const existingDateGroup = groupedByDate.get(dateKey)
      if (existingDateGroup) {
        const existingCategory = existingDateGroup.categories.get(categoryKey)
        if (existingCategory) {
          existingCategory.cards.push(card)
        }
        else {
          existingDateGroup.categories.set(categoryKey, {
            key: categoryKey,
            label: categoryLabel,
            cards: [card],
          })
        }
        continue
      }

      groupedByDate.set(dateKey, {
        key: dateKey,
        label: dateLabel,
        sortValue,
        categories: new Map([
          [categoryKey, {
            key: categoryKey,
            label: categoryLabel,
            cards: [card],
          }],
        ]),
      })
    }

    return Array.from(groupedByDate.values())
      .sort((left, right) => left.sortValue - right.sortValue)
      .map(group => ({
        key: group.key,
        label: group.label,
        sortValue: group.sortValue,
        categories: Array.from(group.categories.values())
          .sort((left, right) => left.label.localeCompare(right.label)),
      }))
  }, [dateLabelFormatter, resolveCardCategory, sortedFutureCards])

  return {
    groupedCards,
    liveCardsByCategory,
    startingSoonGroupsByDate,
  }
}

export function useSportsActiveTradeContext({
  effectiveOpenCardId,
  effectiveTradeSelection,
  filteredCards,
  resolveDisplayButtonKey,
  selectedConditionByCardId,
  orderMarketConditionId,
  orderOutcomeIndex,
}: {
  effectiveOpenCardId: string | null
  effectiveTradeSelection: SportsTradeSelection
  filteredCards: SportsGamesCard[]
  resolveDisplayButtonKey: (card: SportsGamesCard, preferredKey: string | null | undefined) => string | null
  selectedConditionByCardId: Record<string, string>
  orderMarketConditionId: string | null
  orderOutcomeIndex: number | null
}) {
  const activeTradeContext = useMemo<SportsActiveTradeContext | null>(() => {
    if (filteredCards.length === 0) {
      return null
    }

    const selectedCardFromTrade = effectiveTradeSelection.cardId
      ? filteredCards.find(card => card.id === effectiveTradeSelection.cardId) ?? null
      : null
    const selectedCardFromOpen = effectiveOpenCardId
      ? filteredCards.find(card => card.id === effectiveOpenCardId) ?? null
      : null
    const card = selectedCardFromTrade ?? selectedCardFromOpen ?? filteredCards[0] ?? null
    if (!card) {
      return null
    }

    const selectedButtonKey = resolveDisplayButtonKey(card, (
      effectiveTradeSelection.cardId === card.id
        ? effectiveTradeSelection.buttonKey
        : null
    ) ?? selectedConditionByCardId[card.id] ?? resolveDefaultConditionId(card))

    const button = resolveSelectedButton(card, selectedButtonKey)
    if (!button) {
      return null
    }

    const market = resolveSelectedMarket(card, button.key)
    if (!market) {
      return null
    }

    const outcome = resolveSelectedOutcome(market, button)
    if (!outcome) {
      return null
    }

    return {
      card,
      button,
      market,
      outcome,
    }
  }, [effectiveOpenCardId, effectiveTradeSelection.buttonKey, effectiveTradeSelection.cardId, filteredCards, resolveDisplayButtonKey, selectedConditionByCardId])

  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(
      activeTradeContext.card,
      activeTradeContext.button.conditionId,
    )
  }, [activeTradeContext])

  const activeTradeHeaderContext = useMemo<SportsActiveTradeContext | null>(() => {
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

    const matchedButton = activeTradeContext.card.buttons.find(
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
  }, [activeTradeContext, orderMarketConditionId, orderOutcomeIndex])
  const orderPanelOutcomeLabelOverrides = useMemo(
    () => activeTradeContext
      ? resolveOrderPanelOutcomeLabelOverrides(
          activeTradeHeaderContext?.card ?? activeTradeContext.card,
          activeTradeHeaderContext?.market ?? activeTradeContext.market,
        )
      : {},
    [activeTradeContext, activeTradeHeaderContext],
  )
  const orderPanelOutcomeAccentOverrides = useMemo(
    () => activeTradeContext
      ? resolveOrderPanelOutcomeAccentOverrides(
          activeTradeHeaderContext?.card ?? activeTradeContext.card,
          activeTradeHeaderContext?.market ?? activeTradeContext.market,
        )
      : {},
    [activeTradeContext, activeTradeHeaderContext],
  )

  return {
    activeTradeContext,
    activeTradePrimaryOutcomeIndex,
    activeTradeHeaderContext,
    orderPanelOutcomeLabelOverrides,
    orderPanelOutcomeAccentOverrides,
  }
}

export function useSportsOrderStoreSync({
  activeTradeContext,
  setOrderEvent,
  setOrderMarket,
  setOrderOutcome,
  setOrderSide,
}: {
  activeTradeContext: SportsActiveTradeContext | null
  setOrderEvent: (event: Event) => void
  setOrderMarket: (market: Market) => void
  setOrderOutcome: (outcome: Outcome) => void
  setOrderSide: (side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL) => void
}) {
  useEffect(function syncSportsOrderStoreFromActiveTrade() {
    if (!activeTradeContext) {
      return undefined
    }

    const {
      event: currentOrderEvent,
      market: currentOrderMarket,
      outcome: currentOrderOutcome,
    } = useOrder.getState()

    const isSameSelection = (
      currentOrderEvent?.id === activeTradeContext.card.event.id
      && currentOrderMarket?.condition_id === activeTradeContext.market.condition_id
      && currentOrderOutcome?.outcome_index === activeTradeContext.outcome.outcome_index
    )

    if (currentOrderEvent !== activeTradeContext.card.event) {
      setOrderEvent(activeTradeContext.card.event)
    }

    if (currentOrderMarket !== activeTradeContext.market) {
      setOrderMarket(activeTradeContext.market)
    }

    if (currentOrderOutcome !== activeTradeContext.outcome) {
      setOrderOutcome(activeTradeContext.outcome)
    }

    if (!isSameSelection) {
      setOrderSide(ORDER_SIDE.BUY)
    }
    return undefined
  }, [
    activeTradeContext,
    setOrderEvent,
    setOrderMarket,
    setOrderOutcome,
    setOrderSide,
  ])
}
