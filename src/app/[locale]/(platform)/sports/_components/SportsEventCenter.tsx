'use client'

import type {
  EventSectionKey,
  SportsEventCenterProps,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import type {
  SportsGamesButton,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { ChevronLeftIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import { Suspense, useMemo } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import {
  useActiveCardPriceMap,
  useActiveMarketView,
  useActiveTradeContext,
  useAuxiliaryMarketCards,
  useClaimGroupsBySection,
  useDerivedActiveCard,
  useEsportsSegmentTabKeySync,
  useEsportsSegmentTabState,
  useFormatButtonOdds,
  useGroupedButtons,
  useMarketSlugToButtonKey,
  useOddsFormat,
  useOrderStateSync,
  useQuerySelection,
  useRedeemModalState,
  useSectionActions,
  useSectionDerivedData,
  useSelectedSectionButtons,
  useSelectionState,
  useSeriesSegmentPickerData,
  useSeriesSpreadPickerSync,
  useUserPositionsQuery,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-hooks'
import {
  headerIconButtonClass,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-types'
import {
  normalizeLivestreamUrl,
  parseSportsScore,
  resolveMoneylineButtonGridClass,
  resolveTeamShortLabel,
  shouldUseFullScoreboardHeroLabels,
  sortSectionButtons,
} from '@/app/[locale]/(platform)/sports/_components/sports-event-center-utils'
import SportsEventAboutPanel from '@/app/[locale]/(platform)/sports/_components/SportsEventAboutPanel'
import SportsEventLiveStatusIcon from '@/app/[locale]/(platform)/sports/_components/SportsEventLiveStatusIcon'
import SportsEventQuerySync from '@/app/[locale]/(platform)/sports/_components/SportsEventQuerySync'
import SportsEventRelatedGames from '@/app/[locale]/(platform)/sports/_components/SportsEventRelatedGames'
import SportsEventShareButton from '@/app/[locale]/(platform)/sports/_components/SportsEventShareButton'
import {
  resolveButtonDepthStyle,
  resolveButtonOverlayStyle,
  resolveButtonStyle,
  resolveSelectedButton,
  SportsGameDetailsPanel,
  SportsGameGraph,
  SportsOrderPanelMarketInfo,
} from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import SportsLivestreamFloatingPlayer
  from '@/app/[locale]/(platform)/sports/_components/SportsLivestreamFloatingPlayer'
import SportsRedeemModal from '@/app/[locale]/(platform)/sports/_components/SportsRedeemModal'
import SportsSegmentNumberPicker from '@/app/[locale]/(platform)/sports/_components/SportsSegmentNumberPicker'
import AppLink from '@/components/AppLink'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { formatVolume } from '@/lib/formatters'
import { shouldUseCroppedSportsTeamLogo } from '@/lib/sports-team-logo'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useSportsLivestream } from '@/stores/useSportsLivestream'
import { useUser } from '@/stores/useUser'

export default function SportsEventCenter({
  card,
  marketViewCards = [],
  relatedCards = [],
  marketContextEnabled = false,
  sportSlug,
  sportLabel,
  faqItems,
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
  const { querySelection, handleQuerySelectionChange } = useQuerySelection()
  const oddsFormat = useOddsFormat()
  const {
    normalizedMarketViewCards,
    activeMarketView,
    setActiveMarketViewKey,
  } = useActiveMarketView({ card, marketViewCards, initialMarketSlug, initialMarketViewKey })

  const ownerAddress = user?.deposit_wallet_address && user.deposit_wallet_status === 'deployed'
    ? user.deposit_wallet_address
    : null
  const heroCard = card
  const hasMultipleMarketViews = normalizedMarketViewCards.length > 1
  const {
    activeCard,
    heroGroupedButtons,
    segmentLabel,
    segmentPluralLabel,
    isHalftimeResultView,
    baseUsesSectionLayout,
    hasEsportsSegmentedLayout,
  } = useDerivedActiveCard({ card, activeMarketView, vertical })
  const { detailMarketByConditionId, buttonPriceCentsByKey } = useActiveCardPriceMap(activeCard)
  const {
    esportsSegmentTabNumbers,
    activeEsportsSegmentTabKey,
    setActiveEsportsSegmentTabKey,
    activeEsportsSegmentNumber,
    activeSeriesPreviewSegmentNumber,
    setActiveSeriesPreviewSegmentNumber,
    activeSeriesSpreadPickerNumber,
    setActiveSeriesSpreadPickerNumber,
  } = useEsportsSegmentTabState({ activeCard, hasEsportsSegmentedLayout, initialMarketSlug })
  const usesSectionLayout = baseUsesSectionLayout && (!hasEsportsSegmentedLayout || activeEsportsSegmentTabKey === 'series')

  const { data: userPositions } = useUserPositionsQuery({ ownerAddress, activeCardId: activeCard.id })

  const {
    claimedConditionIds,
    setClaimedConditionIds,
    redeemSectionKey,
    setRedeemSectionKey,
    redeemDefaultConditionId,
    setRedeemDefaultConditionId,
  } = useRedeemModalState(activeCard.id)

  const formatButtonOdds = useFormatButtonOdds(oddsFormat)

  const {
    groupedButtons,
    buttonByConditionAndOutcome,
    firstButtonByConditionId,
    availableSections,
    sectionResolvedByKey,
  } = useGroupedButtons({ activeCard, detailMarketByConditionId, hasEsportsSegmentedLayout })

  const claimGroupsBySection = useClaimGroupsBySection({
    activeCard,
    buttonByConditionAndOutcome,
    claimedConditionIds,
    detailMarketByConditionId,
    firstButtonByConditionId,
    userPositions,
  })

  const marketSlugToButtonKey = useMarketSlugToButtonKey({
    activeCard,
    querySelection,
    initialMarketSlug,
  })

  const {
    auxiliaryMarketCards,
    renderedAuxiliaryMarketCards,
    seriesPreviewSegmentWinnerPanels,
    activeSeriesPreviewSegmentWinnerPanel,
    auxiliaryPanelKeyByButtonKey,
    seriesWinnerSegmentPickerOptions,
  } = useAuxiliaryMarketCards({
    activeCard,
    baseUsesSectionLayout,
    hasEsportsSegmentedLayout,
    activeEsportsSegmentTabKey,
    activeEsportsSegmentNumber,
    activeSeriesPreviewSegmentNumber,
  })
  const auxiliaryPanelsForSelectionForState = auxiliaryMarketCards
  const {
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
  } = useSelectionState({
    activeCard,
    auxiliaryPanelsForSelection: auxiliaryPanelsForSelectionForState,
    detailMarketByConditionId,
    groupedButtons,
    usesSectionLayout,
    marketSlugToButtonKey,
    renderedAuxiliaryMarketCards,
  })
  const { selectedSpreadSectionButton, selectedTotalSectionButton } = useSelectedSectionButtons({
    activeCard,
    groupedButtons,
    selectedButtonBySection,
  })
  const {
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
  } = useSeriesSegmentPickerData({
    activeCard,
    groupedButtons,
    detailMarketByConditionId,
    hasEsportsSegmentedLayout,
    activeSeriesSpreadPickerNumber,
    selectedSpreadSectionButton,
    selectedTotalSectionButton,
  })
  const auxiliaryPanelsForSelection = auxiliaryMarketCards
  const {
    updateSectionSelection,
    handlePickSeriesPreviewSegmentNumber,
    handlePickSeriesSpreadSegmentNumber,
    handlePickSeriesTotalLineValue,
    resolveSeriesSpreadSelectedButtonKey,
    resolveSeriesTotalSelectedButtonKey,
  } = useSectionActions({
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
  })

  useSeriesSpreadPickerSync({
    selectedSpreadSectionButton,
    detailMarketByConditionId,
    setActiveSeriesSpreadPickerNumber,
  })

  useEsportsSegmentTabKeySync({
    hasEsportsSegmentedLayout,
    marketSlugToButtonKey,
    activeCard,
    detailMarketByConditionId,
    setActiveEsportsSegmentTabKey,
  })

  const moneylineButtonKey = selectedButtonBySection.moneyline ?? groupedButtons.moneyline[0]?.key ?? null
  const {
    orderSelectionSyncKey,
    fallbackButtonFromOrderState,
    activeTradeContext,
    activeTradeHeaderContext,
    orderPanelOutcomeLabelOverrides,
    orderPanelOutcomeAccentOverrides,
    activeTradePrimaryOutcomeIndex,
  } = useActiveTradeContext({
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
  })
  const pageAboutMarket = activeTradeHeaderContext?.market ?? activeTradeContext?.market ?? null

  const activeTradeContextButtonKey = activeTradeContext?.button.key ?? null

  useOrderStateSync({
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
  })

  const {
    sectionVolumes,
    sectionConditionIdsByKey,
    allCardConditionIds,
    redeemSectionConfig,
    redeemModalSections,
    auxiliaryResolvedByConditionId,
    auxiliaryClaimGroupsByConditionId,
    handleOpenRedeemForCondition,
  } = useSectionDerivedData({
    activeCard,
    groupedButtons,
    claimGroupsBySection,
    auxiliaryPanelsForSelection,
    redeemSectionKey,
    setRedeemDefaultConditionId,
    setRedeemSectionKey,
  })

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
  const parsedStartTimestamp = heroCard.startTime
    ? Date.parse(heroCard.startTime)
    : heroCard.event.sports_start_time
      ? Date.parse(heroCard.event.sports_start_time)
      : heroCard.event.start_date
        ? Date.parse(heroCard.event.start_date)
        : Number.NaN
  const startTimestamp = Number.isFinite(parsedStartTimestamp) ? parsedStartTimestamp : null
  const timeLabel = startTimestamp !== null
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(startTimestamp)
    : 'TBD'
  const dayLabel = startTimestamp !== null
    ? new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(startTimestamp)
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
    && startTimestamp !== null
    && startTimestamp <= currentTimestamp
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
  const esportsSegmentTabs = hasEsportsSegmentedLayout
    ? [
        { key: 'series' as const, label: 'Series Lines' },
        ...esportsSegmentTabNumbers.map(mapNumber => ({ key: `segment-${mapNumber}` as const, label: `${segmentLabel} ${mapNumber}` })),
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
      <div className={cn(`
        min-[1200px]:grid min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:grid-cols-[minmax(0,1fr)_21.25rem]
        min-[1200px]:[align-content:start] min-[1200px]:[align-items:start] min-[1200px]:gap-6
      `)}
      >
        <section
          data-sports-scroll-pane="center"
          className={cn(`
            min-w-0
            min-[1200px]:min-h-0 min-[1200px]:self-stretch min-[1200px]:overflow-y-auto min-[1200px]:overscroll-contain
            min-[1200px]:pr-1
            lg:ml-4
          `)}
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
                className={cn(`
                  flex min-w-0 items-center justify-center gap-1 px-14 text-center text-sm text-muted-foreground
                  sm:px-22
                `)}
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
                    <div className="flex items-center gap-2 text-3xl/none font-semibold tabular-nums">
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
            <EventTabs event={heroCard.event} user={user ?? null} faqItems={faqItems} />
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
