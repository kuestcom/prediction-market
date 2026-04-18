import type {
  AuxiliaryMarketPanel,
  DetailsTab,
  EsportsLayoutTabKey,
  EventSectionKey,
  SportsEventQuerySelection,
  SportsSegmentNumberPickerOption,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
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
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import {
  EMPTY_QUERY_SELECTION,
  SECTION_ORDER,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import {
  areRecordValuesEqual,
  dedupeAuxiliaryButtons,
  getStoredOddsFormatClientSnapshot,
  getStoredOddsFormatServerSnapshot,
  isSegmentedEsportsChildMoneylineMarket,
  isSegmentedEsportsEventCard,
  normalizeSportsMarketType,
  parseEsportsSegmentNumber,
  parseEsportsSegmentTabNumber,
  parseRequestedOutcomeIndex,
  resolveAuxiliaryPanelCreatedAt,
  resolveAuxiliaryPanelThreshold,
  resolveEsportsSegmentLabels,
  resolveEsportsSegmentPanelSortOrder,
  resolveEsportsSegmentPanelTitle,
  resolveEsportsSegmentTabKey,
  resolveEventSectionKeyForButton,
  resolveIndexSetFromOutcomeIndex,
  resolveMarketViewCardBySlug,
  resolveNormalizedSegmentedEsportsCard,
  resolveOutcomeIndexFromPosition,
  resolvePositionShares,
  resolveRedeemOptionLabel,
  resolveRedeemTagAccent,
  sortAuxiliaryButtons,
  sortSectionButtons,
  subscribeToOddsFormatStorage,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-utils'
import {
  buildLinePickerOptions,
  groupButtonsByMarketType,
  resolveDefaultConditionId,
  resolveOrderPanelOutcomeAccentOverrides,
  resolveOrderPanelOutcomeLabelOverrides,
  resolvePreferredLinePickerButton,
  resolveSelectedButton,
  resolveSelectedMarket,
  resolveSelectedOutcome,
  resolveStableSpreadPrimaryOutcomeIndex,
} from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildMarketSlugSelectionSignature } from '@/app/[locale]/(platform)/sports/_utils/sports-event-selection'
import {
  resolveSportsAuxiliaryMarketGroupKey,
  resolveSportsAuxiliaryMarketTitle,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserPositionsForMarket } from '@/lib/data-api/user'
import { resolveOutcomePriceCents, resolveOutcomeSelectionPriceCents } from '@/lib/market-pricing'
import { formatOddsFromCents } from '@/lib/odds-format'

type ReducerStateAction<T> = T | ((current: T) => T)

function resolveReducerStateAction<T>(current: T, action: ReducerStateAction<T>): T {
  return typeof action === 'function'
    ? (action as (value: T) => T)(current)
    : action
}

function useReducerState<T>(initialState: T) {
  return useReducer(
    (current: T, action: ReducerStateAction<T>) => resolveReducerStateAction(current, action),
    initialState,
  )
}

export function useOddsFormat() {
  return useSyncExternalStore(
    subscribeToOddsFormatStorage,
    getStoredOddsFormatClientSnapshot,
    getStoredOddsFormatServerSnapshot,
  )
}

export function useSportsSegmentNumberPicker({
  options,
  activeNumber,
  onPick,
}: {
  options: SportsSegmentNumberPickerOption[]
  activeNumber: number | null
  onPick: (number: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const buttonRefsRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const [startSpacer, setStartSpacer] = useReducerState(0)
  const [endSpacer, setEndSpacer] = useReducerState(0)

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

    const activeButton = buttonRefsRef.current[activeOption.key]
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
    const firstButton = firstOptionKey ? buttonRefsRef.current[firstOptionKey] : null
    const lastButton = lastOptionKey ? buttonRefsRef.current[lastOptionKey] : null
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
  }, [options, setEndSpacer, setStartSpacer])

  useEffect(function alignOnActiveOptionChange() {
    if (activeOptionIndex < 0) {
      return
    }

    alignActiveOption('auto')
  }, [activeOptionIndex, alignActiveOption, endSpacer, startSpacer])

  useEffect(function scheduleSpacerAndAlignmentUpdate() {
    if (options.length <= 1) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      updateSpacers()
      alignActiveOption('auto')
    })

    return function cancelScheduledSpacerAndAlignmentUpdate() {
      window.cancelAnimationFrame(frame)
    }
  }, [alignActiveOption, options.length, updateSpacers])

  useEffect(function observeScrollerResizeForSpacerUpdate() {
    const scrollerElement = scrollerRef.current
    if (options.length <= 1 || !scrollerElement) {
      return
    }

    updateSpacers()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSpacers)
      return function removeResizeListener() {
        window.removeEventListener('resize', updateSpacers)
      }
    }

    const observer = new ResizeObserver(updateSpacers)
    observer.observe(scrollerElement)
    return function disconnectResizeObserver() {
      observer.disconnect()
    }
  }, [options.length, updateSpacers])

  return {
    scrollerRef,
    buttonRefsRef,
    startSpacer,
    endSpacer,
    activeOptionIndex,
    pickOption,
    handlePickPrevious,
    handlePickNext,
  }
}

export function useSportsEventQuerySync(onSelectionChange: (selection: SportsEventQuerySelection) => void) {
  const searchParams = useSearchParams()

  useEffect(function syncQuerySelectionFromSearchParams() {
    onSelectionChange({
      conditionId: searchParams.get('conditionId')?.trim() ?? null,
      outcomeIndex: parseRequestedOutcomeIndex(searchParams.get('outcomeIndex')),
    })

    return function noopQuerySelectionSyncCleanup() {}
  }, [onSelectionChange, searchParams])
}

export function useSportsEventShareButton(event: SportsGamesCard['event']) {
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

  return { shareSuccess, setShareSuccess, maybeHandleDebugCopy }
}

export function useQuerySelection() {
  const [querySelection, setQuerySelection] = useState<SportsEventQuerySelection>(EMPTY_QUERY_SELECTION)

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

  return { querySelection, handleQuerySelectionChange }
}

export function useActiveMarketView({
  card,
  marketViewCards,
  initialMarketSlug,
  initialMarketViewKey,
}: {
  card: SportsGamesCard
  marketViewCards: SportsGamesCardMarketView[]
  initialMarketSlug: string | null
  initialMarketViewKey: SportsEventMarketViewKey | null
}) {
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
  const [activeMarketViewKey, setActiveMarketViewKey] = useReducerState<SportsEventMarketViewKey>(resolvedInitialMarketViewKey)

  useEffect(function resetActiveMarketViewWhenInitialChanges() {
    setActiveMarketViewKey(resolvedInitialMarketViewKey)

    return function noopResetActiveMarketViewCleanup() {}
  }, [resolvedInitialMarketViewKey, setActiveMarketViewKey])

  const activeMarketView = useMemo(
    () => normalizedMarketViewCards.find(view => view.key === activeMarketViewKey)
      ?? normalizedMarketViewCards.find(view => view.key === resolvedInitialMarketViewKey)
      ?? normalizedMarketViewCards[0]
      ?? null,
    [activeMarketViewKey, normalizedMarketViewCards, resolvedInitialMarketViewKey],
  )

  return {
    normalizedMarketViewCards,
    activeMarketView,
    activeMarketViewKey,
    setActiveMarketViewKey,
  }
}

export function useEsportsSegmentTabState({
  activeCard,
  hasEsportsSegmentedLayout,
  initialMarketSlug,
}: {
  activeCard: SportsGamesCard
  hasEsportsSegmentedLayout: boolean
  initialMarketSlug: string | null
}) {
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
  const [activeEsportsSegmentTabKey, setActiveEsportsSegmentTabKey] = useReducerState<EsportsLayoutTabKey>(initialEsportsSegmentTabKey)
  const activeEsportsSegmentNumber = useMemo(
    () => parseEsportsSegmentTabNumber(activeEsportsSegmentTabKey),
    [activeEsportsSegmentTabKey],
  )
  const [activeSeriesPreviewSegmentNumber, setActiveSeriesPreviewSegmentNumber] = useReducerState<number | null>(
    esportsSegmentTabNumbers[0] ?? null,
  )
  const [activeSeriesSpreadPickerNumber, setActiveSeriesSpreadPickerNumber] = useReducerState<number | null>(
    esportsSegmentTabNumbers[0] ?? null,
  )

  useEffect(function resetActiveEsportsSegmentTabKey() {
    setActiveEsportsSegmentTabKey(initialEsportsSegmentTabKey)

    return function noopResetActiveEsportsSegmentTabKeyCleanup() {}
  }, [initialEsportsSegmentTabKey, setActiveEsportsSegmentTabKey])

  useEffect(function clampActiveSeriesPreviewSegmentNumber() {
    setActiveSeriesPreviewSegmentNumber(current => (
      current != null && esportsSegmentTabNumbers.includes(current)
        ? current
        : (esportsSegmentTabNumbers[0] ?? null)
    ))

    return function noopClampActiveSeriesPreviewSegmentNumberCleanup() {}
  }, [esportsSegmentTabNumbers, setActiveSeriesPreviewSegmentNumber])

  useEffect(function clampActiveSeriesSpreadPickerNumber() {
    setActiveSeriesSpreadPickerNumber(current => (
      current != null && esportsSegmentTabNumbers.includes(current)
        ? current
        : (esportsSegmentTabNumbers[0] ?? null)
    ))

    return function noopClampActiveSeriesSpreadPickerNumberCleanup() {}
  }, [esportsSegmentTabNumbers, setActiveSeriesSpreadPickerNumber])

  return {
    esportsSegmentTabNumbers,
    activeEsportsSegmentTabKey,
    setActiveEsportsSegmentTabKey,
    activeEsportsSegmentNumber,
    activeSeriesPreviewSegmentNumber,
    setActiveSeriesPreviewSegmentNumber,
    activeSeriesSpreadPickerNumber,
    setActiveSeriesSpreadPickerNumber,
  }
}

export function useUserPositionsQuery({ ownerAddress, activeCardId }: { ownerAddress: string | null, activeCardId: string }) {
  return useQuery<UserPosition[]>({
    queryKey: ['sports-event-user-positions', ownerAddress, activeCardId],
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
}

export function useRedeemModalState(activeCardId: string) {
  const [claimedConditionIds, setClaimedConditionIds] = useReducerState<Record<string, true>>({})
  const [redeemSectionKey, setRedeemSectionKey] = useReducerState<EventSectionKey | null>(null)
  const [redeemDefaultConditionId, setRedeemDefaultConditionId] = useReducerState<string | null>(null)

  useEffect(function resetRedeemStateOnCardChange() {
    setClaimedConditionIds(() => (activeCardId ? {} : {}))
    setRedeemSectionKey(() => (activeCardId ? null : null))
    setRedeemDefaultConditionId(() => (activeCardId ? null : null))

    return function noopResetRedeemStateOnCardChangeCleanup() {}
  }, [activeCardId, setClaimedConditionIds, setRedeemDefaultConditionId, setRedeemSectionKey])

  return {
    claimedConditionIds,
    setClaimedConditionIds,
    redeemSectionKey,
    setRedeemSectionKey,
    redeemDefaultConditionId,
    setRedeemDefaultConditionId,
  }
}

export function useFormatButtonOdds(oddsFormat: OddsFormat) {
  return useCallback((cents: number) => {
    if (oddsFormat === 'price') {
      return `${cents}¢`
    }
    return formatOddsFromCents(cents, oddsFormat)
  }, [oddsFormat])
}

export function useActiveCardPriceMap(activeCard: SportsGamesCard) {
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

  return { detailMarketByConditionId, buttonPriceCentsByKey }
}

export function useGroupedButtons({
  activeCard,
  detailMarketByConditionId,
  hasEsportsSegmentedLayout,
}: {
  activeCard: SportsGamesCard
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  hasEsportsSegmentedLayout: boolean
}) {
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

  return {
    groupedButtons,
    buttonByConditionAndOutcome,
    firstButtonByConditionId,
    availableSections,
    sectionResolvedByKey,
  }
}

export function useClaimGroupsBySection({
  activeCard,
  buttonByConditionAndOutcome,
  claimedConditionIds,
  detailMarketByConditionId,
  firstButtonByConditionId,
  userPositions,
}: {
  activeCard: SportsGamesCard
  buttonByConditionAndOutcome: Map<string, SportsGamesButton>
  claimedConditionIds: Record<string, true>
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  firstButtonByConditionId: Map<string, SportsGamesButton>
  userPositions: UserPosition[] | undefined
}) {
  return useMemo<Record<EventSectionKey, SportsRedeemModalGroup[]>>(() => {
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
}

export function useMarketSlugToButtonKey({
  activeCard,
  querySelection,
  initialMarketSlug,
}: {
  activeCard: SportsGamesCard
  querySelection: SportsEventQuerySelection
  initialMarketSlug: string | null
}) {
  return useMemo(() => {
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
}

export function useAuxiliaryMarketCards({
  activeCard,
  baseUsesSectionLayout,
  hasEsportsSegmentedLayout,
  activeEsportsSegmentTabKey,
  activeEsportsSegmentNumber,
  activeSeriesPreviewSegmentNumber,
}: {
  activeCard: SportsGamesCard
  baseUsesSectionLayout: boolean
  hasEsportsSegmentedLayout: boolean
  activeEsportsSegmentTabKey: EsportsLayoutTabKey
  activeEsportsSegmentNumber: number | null
  activeSeriesPreviewSegmentNumber: number | null
}) {
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
  const auxiliaryPanelKeyByButtonKey = useMemo(() => {
    const map = new Map<string, string>()

    auxiliaryMarketCards.forEach((entry) => {
      entry.buttons.forEach((button) => {
        map.set(button.key, entry.key)
      })
    })

    return map
  }, [auxiliaryMarketCards])
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

  return {
    auxiliaryMarketCards,
    renderedAuxiliaryMarketCards,
    seriesPreviewSegmentWinnerPanels,
    activeSeriesPreviewSegmentWinnerPanel,
    auxiliaryPanelKeyByButtonKey,
    seriesWinnerSegmentPickerOptions,
  }
}

export function useSelectionState({
  activeCard,
  auxiliaryPanelsForSelection,
  detailMarketByConditionId,
  groupedButtons,
  usesSectionLayout,
  marketSlugToButtonKey,
  renderedAuxiliaryMarketCards,
}: {
  activeCard: SportsGamesCard
  auxiliaryPanelsForSelection: AuxiliaryMarketPanel[]
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  groupedButtons: Record<SportsGamesMarketType, SportsGamesButton[]>
  usesSectionLayout: boolean
  marketSlugToButtonKey: string | null
  renderedAuxiliaryMarketCards: AuxiliaryMarketPanel[]
}) {
  const [selectedButtonBySection, setSelectedButtonBySection] = useReducerState<Record<EventSectionKey, string | null>>({
    moneyline: null,
    spread: null,
    total: null,
    btts: null,
  })
  const [selectedAuxiliaryButtonByConditionId, setSelectedAuxiliaryButtonByConditionId] = useReducerState<
    Record<string, string | null>
  >({})
  const [activeTradeButtonKey, setActiveTradeButtonKey] = useReducerState<string | null>(null)
  const [openSectionKey, setOpenSectionKey] = useReducerState<EventSectionKey | null>(null)
  const [openAuxiliaryConditionId, setOpenAuxiliaryConditionId] = useReducerState<string | null>(null)
  const [tabBySection, setTabBySection] = useState<Record<EventSectionKey, DetailsTab>>({
    moneyline: 'orderBook',
    spread: 'orderBook',
    total: 'orderBook',
    btts: 'orderBook',
  })
  const [tabByAuxiliaryConditionId, setTabByAuxiliaryConditionId] = useReducerState<Record<string, DetailsTab>>({})
  const previousCardIdRef = useRef<string | null>(null)
  const appliedMarketSlugSelectionRef = useRef<string | null>(null)

  useEffect(function syncSelectionsOnActiveCardChange() {
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

      setOpenSectionKey(() => (activeCard.id ? null : null))
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

    return function noopSyncSelectionsOnActiveCardChangeCleanup() {}
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
    setActiveTradeButtonKey,
    setOpenAuxiliaryConditionId,
    setOpenSectionKey,
    setSelectedAuxiliaryButtonByConditionId,
    setSelectedButtonBySection,
    setTabByAuxiliaryConditionId,
  ])

  return {
    selectedButtonBySection,
    setSelectedButtonBySection,
    selectedAuxiliaryButtonByConditionId,
    setSelectedAuxiliaryButtonByConditionId,
    activeTradeButtonKey,
    setActiveTradeButtonKey,
    openSectionKey,
    setOpenSectionKey,
    openAuxiliaryConditionId,
    setOpenAuxiliaryConditionId,
    tabBySection,
    setTabBySection,
    tabByAuxiliaryConditionId,
    setTabByAuxiliaryConditionId,
  }
}

export function useDerivedActiveCard({
  card,
  activeMarketView,
  vertical,
}: {
  card: SportsGamesCard
  activeMarketView: SportsGamesCardMarketView | null
  vertical: SportsVertical
}) {
  const activeSourceCard = activeMarketView?.card ?? card
  const activeCard = useMemo(
    () => resolveNormalizedSegmentedEsportsCard(activeSourceCard, vertical),
    [activeSourceCard, vertical],
  )
  const heroGroupedButtons = useMemo(() => groupButtonsByMarketType(card.buttons), [card.buttons])
  const { singular: segmentLabel, plural: segmentPluralLabel } = useMemo(
    () => resolveEsportsSegmentLabels(activeCard),
    [activeCard],
  )
  const isGameLinesView = (activeMarketView?.key ?? 'gameLines') === 'gameLines'
  const isHalftimeResultView = activeMarketView?.key === 'halftimeResult'
  const baseUsesSectionLayout = isGameLinesView || isHalftimeResultView
  const hasEsportsSegmentedLayout = useMemo(
    () => baseUsesSectionLayout
      && isSegmentedEsportsEventCard(activeCard, vertical)
      && activeCard.detailMarkets.some(market => parseEsportsSegmentNumber(market) != null),
    [activeCard, baseUsesSectionLayout, vertical],
  )

  return {
    activeCard,
    heroGroupedButtons,
    segmentLabel,
    segmentPluralLabel,
    isHalftimeResultView,
    baseUsesSectionLayout,
    hasEsportsSegmentedLayout,
  }
}

export function useSelectedSectionButtons({
  activeCard,
  groupedButtons,
  selectedButtonBySection,
}: {
  activeCard: SportsGamesCard
  groupedButtons: Record<SportsGamesMarketType, SportsGamesButton[]>
  selectedButtonBySection: Record<EventSectionKey, string | null>
}) {
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

  return { selectedSpreadSectionButton, selectedTotalSectionButton }
}

export function useSectionActions({
  isMobile,
  setIsMobileOrderPanelOpen,
  setSelectedButtonBySection,
  setActiveTradeButtonKey,
  setOpenSectionKey,
  setOpenAuxiliaryConditionId,
  setActiveSeriesPreviewSegmentNumber,
  setActiveSeriesSpreadPickerNumber,
  seriesSpreadSegmentOptions,
  seriesTotalLinePickerOptions,
  selectedSpreadSectionButton,
  selectedTotalSectionButton,
  activeSeriesSpreadSegmentOption,
  activeSeriesSpreadConditionId,
  activeSeriesTotalLineOption,
}: {
  isMobile: boolean
  setIsMobileOrderPanelOpen: (open: boolean) => void
  setSelectedButtonBySection: React.Dispatch<React.SetStateAction<Record<EventSectionKey, string | null>>>
  setActiveTradeButtonKey: React.Dispatch<React.SetStateAction<string | null>>
  setOpenSectionKey: React.Dispatch<React.SetStateAction<EventSectionKey | null>>
  setOpenAuxiliaryConditionId: React.Dispatch<React.SetStateAction<string | null>>
  setActiveSeriesPreviewSegmentNumber: React.Dispatch<React.SetStateAction<number | null>>
  setActiveSeriesSpreadPickerNumber: React.Dispatch<React.SetStateAction<number | null>>
  seriesSpreadSegmentOptions: Array<{
    number: number
    conditionIds: string[]
    buttonsByConditionId: Map<string, SportsGamesButton[]>
  }>
  seriesTotalLinePickerOptions: SportsLinePickerOption[]
  selectedSpreadSectionButton: SportsGamesButton | null
  selectedTotalSectionButton: SportsGamesButton | null
  activeSeriesSpreadSegmentOption: {
    number: number
    conditionIds: string[]
    buttonsByConditionId: Map<string, SportsGamesButton[]>
  } | null
  activeSeriesSpreadConditionId: string | null
  activeSeriesTotalLineOption: SportsLinePickerOption | null
}) {
  const updateSectionSelection = useCallback((
    sectionKey: EventSectionKey,
    buttonKey: string,
    options?: { panelMode?: 'full' | 'partial' | 'preserve' },
  ) => {
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
  }, [
    isMobile,
    setIsMobileOrderPanelOpen,
    setActiveTradeButtonKey,
    setOpenAuxiliaryConditionId,
    setOpenSectionKey,
    setSelectedButtonBySection,
  ])

  const handlePickSeriesPreviewSegmentNumber = useCallback((number: number) => {
    setActiveSeriesPreviewSegmentNumber(number)
  }, [setActiveSeriesPreviewSegmentNumber])

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
  }, [selectedSpreadSectionButton, seriesSpreadSegmentOptions, setActiveSeriesSpreadPickerNumber, updateSectionSelection])
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

  return {
    updateSectionSelection,
    handlePickSeriesPreviewSegmentNumber,
    handlePickSeriesSpreadSegmentNumber,
    handlePickSeriesTotalLineValue,
    resolveSeriesSpreadSelectedButtonKey,
    resolveSeriesTotalSelectedButtonKey,
  }
}

export function useSectionDerivedData({
  activeCard,
  groupedButtons,
  claimGroupsBySection,
  auxiliaryPanelsForSelection,
  redeemSectionKey,
  setRedeemDefaultConditionId,
  setRedeemSectionKey,
}: {
  activeCard: SportsGamesCard
  groupedButtons: Record<SportsGamesMarketType, SportsGamesButton[]>
  claimGroupsBySection: Record<EventSectionKey, SportsRedeemModalGroup[]>
  auxiliaryPanelsForSelection: AuxiliaryMarketPanel[]
  redeemSectionKey: EventSectionKey | null
  setRedeemDefaultConditionId: React.Dispatch<React.SetStateAction<string | null>>
  setRedeemSectionKey: React.Dispatch<React.SetStateAction<EventSectionKey | null>>
}) {
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
  }, [claimGroupsBySection, sectionConditionIdsByKey, setRedeemDefaultConditionId, setRedeemSectionKey])

  return {
    sectionVolumes,
    sectionConditionIdsByKey,
    allCardConditionIds,
    redeemSectionConfig,
    redeemModalSections,
    auxiliaryResolvedByConditionId,
    auxiliaryClaimGroupsByConditionId,
    handleOpenRedeemForCondition,
  }
}

export function useActiveTradeContext({
  activeCard,
  usesSectionLayout,
  activeTradeButtonKey,
  openSectionKey,
  openAuxiliaryConditionId,
  selectedButtonBySection,
  selectedAuxiliaryButtonByConditionId,
  marketSlugToButtonKey,
  renderedAuxiliaryMarketCards,
  moneylineButtonKey,
  orderEventId,
  orderMarketConditionId,
  orderOutcomeIndex,
}: {
  activeCard: SportsGamesCard
  usesSectionLayout: boolean
  activeTradeButtonKey: string | null
  openSectionKey: EventSectionKey | null
  openAuxiliaryConditionId: string | null
  selectedButtonBySection: Record<EventSectionKey, string | null>
  selectedAuxiliaryButtonByConditionId: Record<string, string | null>
  marketSlugToButtonKey: string | null
  renderedAuxiliaryMarketCards: AuxiliaryMarketPanel[]
  moneylineButtonKey: string | null
  orderEventId: string | null
  orderMarketConditionId: string | null
  orderOutcomeIndex: number | null
}) {
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
  const activeTradePrimaryOutcomeIndex = useMemo(() => {
    if (!activeTradeContext || activeTradeContext.button.marketType !== 'spread') {
      return null
    }

    return resolveStableSpreadPrimaryOutcomeIndex(activeCard, activeTradeContext.button.conditionId)
  }, [activeCard, activeTradeContext])

  return {
    orderSelectionSyncKey,
    fallbackButtonFromOrderState,
    activeTradeContext,
    activeTradeHeaderContext,
    orderPanelOutcomeLabelOverrides,
    orderPanelOutcomeAccentOverrides,
    activeTradePrimaryOutcomeIndex,
  }
}

export function useSeriesSpreadPickerSync({
  selectedSpreadSectionButton,
  detailMarketByConditionId,
  setActiveSeriesSpreadPickerNumber,
}: {
  selectedSpreadSectionButton: SportsGamesButton | null
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  setActiveSeriesSpreadPickerNumber: (setter: (current: number | null) => number | null) => void
}) {
  useEffect(function syncActiveSeriesSpreadPickerToSelection() {
    const selectedMarket = selectedSpreadSectionButton
      ? detailMarketByConditionId.get(selectedSpreadSectionButton.conditionId) ?? null
      : null
    const selectedNumber = parseEsportsSegmentNumber(selectedMarket)
    if (selectedNumber == null) {
      return
    }

    setActiveSeriesSpreadPickerNumber(current => current === selectedNumber ? current : selectedNumber)

    return function noopSyncActiveSeriesSpreadPickerToSelectionCleanup() {}
  }, [detailMarketByConditionId, selectedSpreadSectionButton, setActiveSeriesSpreadPickerNumber])
}

export function useEsportsSegmentTabKeySync({
  hasEsportsSegmentedLayout,
  marketSlugToButtonKey,
  activeCard,
  detailMarketByConditionId,
  setActiveEsportsSegmentTabKey,
}: {
  hasEsportsSegmentedLayout: boolean
  marketSlugToButtonKey: string | null
  activeCard: SportsGamesCard
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  setActiveEsportsSegmentTabKey: (value: EsportsLayoutTabKey) => void
}) {
  useEffect(function syncEsportsSegmentTabKeyFromMarketSlug() {
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

    return function noopSyncEsportsSegmentTabKeyFromMarketSlugCleanup() {}
  }, [activeCard.buttons, detailMarketByConditionId, hasEsportsSegmentedLayout, marketSlugToButtonKey, setActiveEsportsSegmentTabKey])
}

export function useOrderStateSync({
  activeCard,
  activeTradeContextButtonKey,
  orderEventId,
  orderMarketConditionId,
  orderOutcomeIndex,
  marketSlugToButtonKey,
  fallbackButtonFromOrderState,
  orderSelectionSyncKey,
  usesSectionLayout,
  detailMarketByConditionId,
  auxiliaryPanelKeyByButtonKey,
  setActiveTradeButtonKey,
  setSelectedButtonBySection,
  setSelectedAuxiliaryButtonByConditionId,
  setOrderEvent,
  setOrderMarket,
  setOrderOutcome,
  setOrderSide,
}: {
  activeCard: SportsGamesCard
  activeTradeContextButtonKey: string | null
  orderEventId: string | null
  orderMarketConditionId: string | null
  orderOutcomeIndex: number | null
  marketSlugToButtonKey: string | null
  fallbackButtonFromOrderState: string | null
  orderSelectionSyncKey: string | null
  usesSectionLayout: boolean
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  auxiliaryPanelKeyByButtonKey: Map<string, string>
  setActiveTradeButtonKey: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedButtonBySection: React.Dispatch<React.SetStateAction<Record<EventSectionKey, string | null>>>
  setSelectedAuxiliaryButtonByConditionId: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  setOrderEvent: (event: SportsGamesCard['event']) => void
  setOrderMarket: (market: SportsGamesCard['detailMarkets'][number]) => void
  setOrderOutcome: (outcome: SportsGamesCard['detailMarkets'][number]['outcomes'][number]) => void
  setOrderSide: (side: typeof ORDER_SIDE[keyof typeof ORDER_SIDE]) => void
}) {
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

  useEffect(function applyFallbackOrderStateToSelection() {
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

    return function noopApplyFallbackOrderStateToSelectionCleanup() {}
  }, [
    activeCard.buttons,
    auxiliaryPanelKeyByButtonKey,
    detailMarketByConditionId,
    fallbackButtonFromOrderState,
    marketSlugToButtonKey,
    orderSelectionSyncKey,
    usesSectionLayout,
    setActiveTradeButtonKey,
    setSelectedAuxiliaryButtonByConditionId,
    setSelectedButtonBySection,
  ])

  useEffect(function trackCurrentOrderSelection() {
    currentOrderSelectionRef.current = {
      eventId: orderEventId,
      conditionId: orderMarketConditionId,
      outcomeIndex: orderOutcomeIndex,
    }
  }, [orderEventId, orderMarketConditionId, orderOutcomeIndex])

  useEffect(function pushActiveTradeSelectionToOrderState() {
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

    return function noopPushActiveTradeSelectionToOrderStateCleanup() {}
  }, [
    activeCard,
    activeTradeContextButtonKey,
    setOrderEvent,
    setOrderMarket,
    setOrderOutcome,
    setOrderSide,
  ])
}

export function useSeriesSegmentPickerData({
  activeCard,
  groupedButtons,
  detailMarketByConditionId,
  hasEsportsSegmentedLayout,
  activeSeriesSpreadPickerNumber,
  selectedSpreadSectionButton,
  selectedTotalSectionButton,
}: {
  activeCard: SportsGamesCard
  groupedButtons: Record<SportsGamesMarketType, SportsGamesButton[]>
  detailMarketByConditionId: Map<string, SportsGamesCard['detailMarkets'][number]>
  hasEsportsSegmentedLayout: boolean
  activeSeriesSpreadPickerNumber: number | null
  selectedSpreadSectionButton: SportsGamesButton | null
  selectedTotalSectionButton: SportsGamesButton | null
}) {
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

  return {
    seriesSpreadSegmentOptions,
    activeSeriesSpreadSegmentOption,
    activeSeriesSpreadSegmentNumber,
    activeSeriesSpreadConditionId,
    seriesSpreadSegmentPickerOptions,
    seriesTotalLinePickerOptions,
    activeSeriesTotalLineOption,
    activeSeriesTotalConditionId,
    activeSeriesTotalLineValue,
    seriesTotalPickerOptions,
  }
}
