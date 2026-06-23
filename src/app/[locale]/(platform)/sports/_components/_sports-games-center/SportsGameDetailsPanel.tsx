'use client'

import type { SportsGameDetailsPanelProps } from './sports-games-center-types'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import SellPositionModal from '@/app/[locale]/(platform)/_components/SellPositionModal'
import EventConvertPositionsDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventConvertPositionsDialog'
import EventOrderBook, { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import SportsEventAboutPanel from '@/app/[locale]/(platform)/sports/_components/SportsEventAboutPanel'
import { useIsMobile } from '@/hooks/useIsMobile'
import { OUTCOME_INDEX } from '@/lib/constants'
import {
  formatAmountInputValue,
  formatCurrency,
  formatSharesLabel,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { resolveTradeHeaderBadgeAccent } from './sports-games-center-utils'
import SportsGameGraph from './SportsGameGraph'
import {
  useSportsCardDerivations,
  useSportsCardUserPositionsQuery,
  useSportsCashOutHandlers,
  useSportsConvertDialog,
  useSportsDetailsPanelInteractions,
  useSportsDetailsTabs,
  useSportsGameDetailsPanelLocalState,
  useSportsGameDetailsPanelOrderStore,
  useSportsLinePicker,
  useSportsOwnerAddress,
  useSportsPositionOddsFormatters,
  useSportsPositionTags,
  useSportsSelectedMarketDerivations,
} from './useSportsGameDetailsPanel'

export default function SportsGameDetailsPanel({
  card,
  activeDetailsTab,
  selectedButtonKey,
  showBottomContent,
  defaultGraphTimeRange = '1W',
  allowedConditionIds = null,
  positionsTitle,
  showAboutTab = false,
  aboutEvent = null,
  rulesEvent = null,
  showRedeemInPositions = false,
  onOpenRedeemForCondition = null,
  oddsFormat = 'price',
  onChangeTab,
  onSelectButton,
}: SportsGameDetailsPanelProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const linePickerSpacerWidth = 'calc(50% - 28px)'

  const orderStore = useSportsGameDetailsPanelOrderStore()
  const {
    orderMarketConditionId,
    orderOutcomeIndex,
    setOrderMarket,
    setOrderOutcome,
    setOrderAmount,
  } = orderStore

  const {
    cashOutPayload,
    setCashOutPayload,
    isPositionsExpanded,
    setIsPositionsExpanded,
    convertTagKey,
    setConvertTagKey,
  } = useSportsGameDetailsPanelLocalState()

  const ownerAddress = useSportsOwnerAddress()

  const {
    cardMarketByConditionId,
    cardButtonsByConditionAndOutcome,
    cardFirstButtonByCondition,
    moneylineConditionIds,
    isNegRiskEnabled,
  } = useSportsCardDerivations(card)

  const userPositions = useSportsCardUserPositionsQuery({
    ownerAddress,
    cardId: card.id,
    showBottomContent,
  })

  const { positionTags, visiblePositionTags, hiddenPositionTagsCount } = useSportsPositionTags({
    ownerAddress,
    userPositions,
    allowedConditionIds,
    card,
    cardMarketByConditionId,
    cardButtonsByConditionAndOutcome,
    cardFirstButtonByCondition,
  })

  const { convertDialogTag, convertDialogOptions, convertDialogOutcomes } = useSportsConvertDialog({
    convertTagKey,
    positionTags,
    card,
    allowedConditionIds,
  })

  const {
    selectedButton,
    selectedMarket,
    selectedOutcome,
    selectedLinePickerMarketType,
    nextOutcome,
    nextButton,
    tradeSelectionLabel,
    switchTooltip,
    selectedMarketTokenIds,
    isSelectedMarketResolved,
  } = useSportsSelectedMarketDerivations({
    card,
    selectedButtonKey,
    orderMarketConditionId,
    orderOutcomeIndex,
  })

  const {
    linePickerScrollerRef,
    linePickerButtonsRef,
    linePickerOptions,
    activeLineOptionIndex,
    hasLinePicker,
    pickLineOption,
    handlePickPreviousLine,
    handlePickNextLine,
  } = useSportsLinePicker({
    card,
    allowedConditionIds,
    selectedLinePickerMarketType,
    selectedButton,
    onSelectButton,
  })

  const { detailTabs, resolvedActiveDetailsTab } = useSportsDetailsTabs({
    activeDetailsTab,
    showBottomContent,
    showAboutTab,
    aboutEvent,
    isSelectedMarketResolved,
    onChangeTab,
  })

  const {
    data: orderBookSummaries,
    isLoading: isOrderBookLoading,
    isRefetching: isOrderBookRefetching,
    refetch: refetchOrderBook,
  } = useOrderBookSummaries(selectedMarketTokenIds, {
    enabled: showBottomContent && activeDetailsTab === 'orderBook' && selectedMarketTokenIds.length > 0,
  })

  const { formatPositionOddsLabel, formatAverageCellLabel } = useSportsPositionOddsFormatters(oddsFormat)

  const { handleCashOutTag, handleCashOutModalChange, handleCashOutSubmit } = useSportsCashOutHandlers({
    card,
    isMobile,
    setCashOutPayload,
    orderStore,
  })

  const { handleToggleOutcome, handleOpenConvert } = useSportsDetailsPanelInteractions({
    selectedMarket,
    nextOutcome,
    nextButton,
    onSelectButton,
    setOrderMarket,
    setOrderOutcome,
    isNegRiskEnabled,
    moneylineConditionIds,
    setConvertTagKey,
  })

  const isStandalonePositionsCard = Boolean(positionsTitle)
  const shouldShowPortfolio = visiblePositionTags.length > 0
  const showPositionTagSummary = !isStandalonePositionsCard

  if (!showBottomContent && !hasLinePicker && !shouldShowPortfolio) {
    return null
  }

  return (
    <>
      <div
        className={cn(
          'overflow-x-visible overflow-y-hidden transition-[max-height,opacity,margin] duration-200',
          hasLinePicker
            ? (showBottomContent ? '-mt-3 mb-3 max-h-32 opacity-100' : '-mt-3 mb-0 max-h-32 opacity-100')
            : 'mb-0 max-h-0 opacity-0',
        )}
      >
        {hasLinePicker && (
          <div className={cn(
            '-mx-2.5 bg-card px-2.5',
            showBottomContent ? 'pb-0' : 'pb-2',
          )}
          >
            {!showBottomContent && <div className="-mx-2.5 border-t" />}

            <div className="pt-2">
              <div className="mt-0.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePickPreviousLine}
                  disabled={activeLineOptionIndex <= 0}
                  className={cn(
                    `
                      inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
                    `,
                    activeLineOptionIndex > 0
                      ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                      : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label="Previous line"
                >
                  <ChevronLeftIcon className="size-4.5" />
                </button>

                <div
                  className="relative min-w-0 flex-1"
                >
                  <span
                    aria-hidden
                    className={cn(`
                      pointer-events-none absolute -top-2 left-1/2 h-2 w-3 -translate-x-1/2 bg-primary
                      [clip-path:polygon(50%_100%,0_0,100%_0)]
                    `)}
                  />

                  <div
                    ref={linePickerScrollerRef}
                    className={cn(`
                      flex min-w-0 snap-x snap-mandatory scrollbar-none items-center gap-2 overflow-x-auto scroll-smooth
                      [&::-webkit-scrollbar]:hidden
                    `)}
                  >
                    <span aria-hidden className="shrink-0" style={{ width: linePickerSpacerWidth }} />
                    {linePickerOptions.map((option, index) => (
                      <button
                        key={`${card.id}-${option.conditionId}`}
                        type="button"
                        onClick={() => pickLineOption(index)}
                        ref={(node) => {
                          linePickerButtonsRef.current[option.conditionId] = node
                        }}
                        className={cn(
                          `
                            w-10 shrink-0 snap-center text-center text-sm font-medium text-muted-foreground
                            transition-colors
                          `,
                          index === activeLineOptionIndex
                            ? 'text-base font-semibold text-foreground'
                            : 'hover:text-foreground/80',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                    <span aria-hidden className="shrink-0" style={{ width: linePickerSpacerWidth }} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePickNextLine}
                  disabled={activeLineOptionIndex < 0 || activeLineOptionIndex >= linePickerOptions.length - 1}
                  className={cn(
                    `
                      inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
                    `,
                    activeLineOptionIndex >= 0 && activeLineOptionIndex < linePickerOptions.length - 1
                      ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground'
                      : 'cursor-not-allowed opacity-40',
                  )}
                  aria-label="Next line"
                >
                  <ChevronRightIcon className="size-4.5" />
                </button>
              </div>
            </div>

            {showBottomContent && (
              <div className="-mx-2.5 mt-2 border-t" />
            )}
          </div>
        )}
      </div>

      {showBottomContent && (
        <>
          <div className="-mx-2.5 mb-3 border-b bg-card">
            <div className="flex w-full items-center gap-2 px-2.5">
              <div className="flex w-0 flex-1 items-center gap-4 overflow-x-auto">
                {detailTabs.map(tab => (
                  <button
                    key={`${card.id}-${tab.id}`}
                    type="button"
                    onClick={() => onChangeTab(tab.id)}
                    className={cn(
                      `
                        border-b-2 border-transparent pt-1 pb-2 text-sm font-semibold whitespace-nowrap
                        transition-colors
                      `,
                      resolvedActiveDetailsTab === tab.id
                        ? 'border-primary text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {selectedMarketTokenIds.length > 0 && resolvedActiveDetailsTab !== 'about' && (
                <button
                  type="button"
                  className={cn(
                    `
                      -mt-1 ml-auto inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground
                      transition-colors
                    `,
                    'hover:bg-muted/70 hover:text-foreground',
                    'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  )}
                  aria-label="Refresh order book"
                  title="Refresh order book"
                  onClick={() => { void refetchOrderBook() }}
                  disabled={isOrderBookLoading || isOrderBookRefetching}
                >
                  <RefreshCwIcon
                    className={cn(
                      'size-3',
                      { 'animate-spin': isOrderBookLoading || isOrderBookRefetching },
                    )}
                  />
                </button>
              )}
            </div>
          </div>

          {resolvedActiveDetailsTab === 'orderBook' && (
            (selectedMarket && selectedOutcome)
              ? (
                  <div className={cn('-mx-2.5', visiblePositionTags.length === 0 && '-mb-2.5')}>
                    <EventOrderBook
                      market={selectedMarket}
                      outcome={selectedOutcome}
                      summaries={orderBookSummaries}
                      isLoadingSummaries={isOrderBookLoading && !orderBookSummaries}
                      eventSlug={card.slug}
                      surfaceVariant="sportsCard"
                      oddsFormat={oddsFormat}
                      tradeLabel={`TRADE ${tradeSelectionLabel}`}
                      onToggleOutcome={nextOutcome ? handleToggleOutcome : undefined}
                      toggleOutcomeTooltip={switchTooltip ?? undefined}
                      openMobileOrderPanelOnLevelSelect={isMobile}
                    />
                  </div>
                )
              : (
                  <div className="rounded-lg border bg-card px-3 py-6 text-sm text-muted-foreground">
                    Order book is unavailable for this game.
                  </div>
                )
          )}

          {resolvedActiveDetailsTab === 'graph' && (
            <SportsGameGraph
              key={`${card.id}:${selectedButton?.marketType ?? 'moneyline'}:${selectedButton?.conditionId ?? 'none'}:${defaultGraphTimeRange}`}
              card={card}
              selectedMarketType={selectedButton?.marketType ?? 'moneyline'}
              selectedConditionId={selectedButton?.conditionId ?? null}
              defaultTimeRange={defaultGraphTimeRange}
              variant="sportsCardLegend"
            />
          )}

          {resolvedActiveDetailsTab === 'about' && aboutEvent && (
            <SportsEventAboutPanel
              event={aboutEvent}
              rulesEvent={rulesEvent}
              market={selectedMarket}
            />
          )}
        </>
      )}

      {shouldShowPortfolio && (
        <div className={cn(
          '-mx-2.5 bg-card',
          isStandalonePositionsCard && 'overflow-hidden rounded-[inherit]',
        )}
        >
          <div className={cn(!isStandalonePositionsCard && 'border-t')}>
            <div
              role="button"
              tabIndex={0}
              data-sports-card-control="true"
              onClick={(event) => {
                event.stopPropagation()
                setIsPositionsExpanded(current => !current)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                setIsPositionsExpanded(current => !current)
              }}
              className={cn(
                'flex w-full items-center bg-card text-muted-foreground transition-colors hover:bg-secondary',
                isStandalonePositionsCard
                  ? 'min-h-16 gap-3 px-4 py-3 text-sm'
                  : 'min-h-11 gap-2 px-2.5 py-2 text-xs sm:px-2.5',
              )}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center text-foreground',
                  isStandalonePositionsCard ? 'text-sm font-semibold' : 'text-sm font-semibold',
                )}
              >
                <span>{positionsTitle ?? t('Positions')}</span>
              </div>

              {showPositionTagSummary && (
                <>
                  <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 overflow-hidden">
                    {visiblePositionTags.map((tag) => {
                      const tagAccent = tag.button
                        ? resolveTradeHeaderBadgeAccent(tag.button)
                        : (tag.outcomeIndex === OUTCOME_INDEX.NO
                            ? { className: 'bg-no/10 text-no', style: undefined }
                            : { className: 'bg-yes/10 text-yes', style: undefined })

                      return (
                        <span
                          key={tag.key}
                          className={cn(
                            `
                              group/position inline-flex max-w-44 min-w-0 items-center rounded-sm px-2.5 py-1 text-xs
                              font-semibold
                            `,
                            tagAccent.className,
                          )}
                          style={tagAccent.style}
                        >
                          <span className="truncate whitespace-nowrap">
                            {`${tag.summaryLabel} | ${formatSharesLabel(tag.shares)} @ ${formatPositionOddsLabel(tag.avgPriceCents)}`}
                          </span>
                          <button
                            type="button"
                            data-sports-card-control="true"
                            className={cn(
                              'ml-1 inline-flex w-0 items-center justify-center overflow-hidden opacity-0',
                              'transition-all duration-150 group-hover/position:w-3 group-hover/position:opacity-100',
                              'pointer-events-none group-hover/position:pointer-events-auto',
                            )}
                            aria-label={`Cash out ${tag.summaryLabel}`}
                            onClick={event => void handleCashOutTag(tag, event)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>

                  {hiddenPositionTagsCount > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {`+${hiddenPositionTagsCount} more`}
                    </span>
                  )}
                </>
              )}

              <ChevronDownIcon
                className={cn(
                  'shrink-0 transition-transform',
                  !showPositionTagSummary && 'ml-auto',
                  isStandalonePositionsCard ? 'size-4' : 'size-3.5',
                  isPositionsExpanded ? 'rotate-180' : 'rotate-0',
                )}
              />
            </div>

            {isPositionsExpanded && (
              <div className="border-t bg-card px-2.5 py-2 sm:px-2.5" data-sports-card-control="true">
                <div className="w-full overflow-x-auto" onClick={event => event.stopPropagation()}>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <th className="py-2 text-left">Type</th>
                        <th className="p-2 text-left">Outcome</th>
                        <th className="p-2 text-right">Avg</th>
                        <th className="p-2 text-right">Cost</th>
                        <th className="p-2 text-right">To Win</th>
                        <th className="p-2 text-right">Current</th>
                        <th className="py-2 text-right" />
                      </tr>
                      <tr>
                        <th colSpan={7} className="p-0">
                          <div className="border-t" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {positionTags.map((tag) => {
                        const tagAccent = tag.button
                          ? resolveTradeHeaderBadgeAccent(tag.button)
                          : (tag.outcomeIndex === OUTCOME_INDEX.NO
                              ? { className: 'bg-no/10 text-no', style: undefined }
                              : { className: 'bg-yes/10 text-yes', style: undefined })
                        const costLabel = typeof tag.totalCost === 'number'
                          ? formatCurrency(tag.totalCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'
                        const toWinLabel = formatCurrency(tag.shares, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        const currentLabel = formatCurrency(tag.currentValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        const pnlValue = typeof tag.totalCost === 'number'
                          ? tag.currentValue - tag.totalCost + tag.realizedPnl
                          : null
                        const pnlLabel = pnlValue == null
                          ? '—'
                          : `${pnlValue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(pnlValue), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        const pnlClass = pnlValue == null
                          ? (tag.currentValue >= 0 ? 'text-yes' : 'text-no')
                          : pnlValue >= 0
                            ? 'text-yes'
                            : 'text-no'
                        const canConvert = isNegRiskEnabled
                          && moneylineConditionIds.has(tag.conditionId)
                          && tag.outcomeIndex === OUTCOME_INDEX.NO
                          && tag.outcome.outcome_index === OUTCOME_INDEX.NO
                          && tag.shares > 0
                        const canRedeem = showRedeemInPositions
                          && Boolean(tag.market.is_resolved || tag.market.condition?.resolved)

                        return (
                          <tr key={tag.key} className="text-xs text-foreground">
                            <td className="py-2 font-medium">{tag.marketTypeLabel}</td>
                            <td className="p-2">
                              <span
                                className={cn(
                                  'inline-flex min-w-0 items-center rounded-sm px-2.5 py-1 text-xs font-semibold',
                                  tagAccent.className,
                                )}
                                style={tagAccent.style}
                              >
                                {`${tag.summaryLabel} | ${formatSharesLabel(tag.shares)}`}
                              </span>
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatAverageCellLabel(tag.avgPriceCents)}
                            </td>
                            <td className="p-2 text-right font-medium">{costLabel}</td>
                            <td className="p-2 text-right font-medium">{toWinLabel}</td>
                            <td className={cn('p-2 text-right font-medium', pnlClass)}>
                              {currentLabel}
                              {' '}
                              (
                              {pnlLabel}
                              )
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canConvert && (
                                  <button
                                    type="button"
                                    data-sports-card-control="true"
                                    className={cn(`
                                      inline-flex h-7 items-center justify-center rounded-sm bg-secondary/70 px-2
                                      text-xs font-semibold text-foreground transition-colors
                                      hover:bg-secondary
                                    `)}
                                    onClick={event => handleOpenConvert(tag, event)}
                                  >
                                    Convert
                                  </button>
                                )}
                                {canRedeem
                                  ? (
                                      <button
                                        type="button"
                                        data-sports-card-control="true"
                                        className={cn(`
                                          inline-flex h-7 items-center justify-center rounded-sm border border-border/70
                                          bg-background px-2 text-xs font-semibold text-foreground transition-colors
                                          hover:bg-secondary/35
                                        `)}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          onOpenRedeemForCondition?.(tag.conditionId)
                                        }}
                                      >
                                        Redeem
                                      </button>
                                    )
                                  : (
                                      <button
                                        type="button"
                                        data-sports-card-control="true"
                                        className={cn(`
                                          inline-flex h-7 items-center justify-center rounded-sm border border-border/70
                                          bg-background/40 px-2 text-xs font-semibold text-foreground transition-colors
                                          hover:bg-secondary/40
                                        `)}
                                        onClick={event => void handleCashOutTag(tag, event)}
                                      >
                                        Sell
                                      </button>
                                    )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {convertDialogTag && (
        <EventConvertPositionsDialog
          open={Boolean(convertDialogTag)}
          options={convertDialogOptions}
          outcomes={convertDialogOutcomes}
          negRiskMarketId={card.event.neg_risk_market_id ?? undefined}
          isNegRiskAugmented={Boolean(card.event.neg_risk_augmented)}
          onOpenChange={(open) => {
            if (!open) {
              setConvertTagKey(null)
            }
          }}
        />
      )}

      {cashOutPayload && (
        <SellPositionModal
          open={Boolean(cashOutPayload)}
          onOpenChange={handleCashOutModalChange}
          outcomeLabel={cashOutPayload.outcomeLabel}
          outcomeShortLabel={cashOutPayload.outcomeShortLabel}
          outcomeIconUrl={cashOutPayload.outcomeIconUrl}
          fallbackIconUrl={card.event.icon_url}
          shares={cashOutPayload.shares}
          filledShares={cashOutPayload.filledShares}
          avgPriceCents={cashOutPayload.avgPriceCents}
          receiveAmount={cashOutPayload.receiveAmount}
          sellBids={cashOutPayload.sellBids}
          onSharesChange={sharesToSell =>
            setOrderAmount(formatAmountInputValue(sharesToSell, { roundingMode: 'floor' }))}
          onCashOut={handleCashOutSubmit}
          onEditOrder={(sharesToSell) => {
            setOrderAmount(formatAmountInputValue(sharesToSell, { roundingMode: 'floor' }))
            setCashOutPayload(null)
          }}
        />
      )}
    </>
  )
}
