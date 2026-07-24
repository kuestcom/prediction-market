'use client'

import type { EventOrderPanelOutcomeSelectedAccent } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import type { OutcomeArbitrageQuote } from '@/lib/outcome-arbitrage-quote'
import type { Market, SportsTeam } from '@/types'
import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedCounter } from 'react-animated-counter'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelAnimatedCents
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelAnimatedCents'
import EventOrderPanelSubmitButton
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelSubmitButton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useKuestFeeRate } from '@/hooks/useKuestFeeRate'
import { formatDisplayAmount, getAmountSizeClass, sanitizeNumericInput } from '@/lib/amount-input'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { normalizeBookLevels } from '@/lib/order-panel-utils'
import { MIN_LIMIT_ORDER_SHARES, MIN_MARKET_BUY_AMOUNT } from '@/lib/orders/validation'
import {
  buildOutcomeArbitragePreview,
  buildOutcomeArbitrageQuote,
  constrainOutcomeArbitrageQuoteForKuestFok,
  findMinimumExecutableOutcomeArbitrageQuote,
  scaleOutcomeArbitrageQuote,
} from '@/lib/outcome-arbitrage-quote'
import { cn } from '@/lib/utils'

const BALANCE_COMPARISON_EPSILON = 1e-8
const CURRENCY_SCALE = 100
type AmountPreset = 'min' | 'mid' | 'max'

interface EventOrderPanelOutcomeArbitrageProps {
  market: Market
  yesOutcomeLabel: string
  noOutcomeLabel: string
  yesOutcomeAccent: EventOrderPanelOutcomeSelectedAccent | null
  noOutcomeAccent: EventOrderPanelOutcomeSelectedAccent | null
  sportsTeams: SportsTeam[] | null
  siteWalletReady: boolean
  kuestBalance: number
  kuestFeeBps: number
  isSubmitting: boolean
  submissionStep: 0 | 1 | 2 | 3
  onRequireSiteWallet: () => void
  onSubmit: (quote: OutcomeArbitrageQuote) => void
}

function normalizeHexColor(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }
  const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(withHash) ? withHash : null
}

function normalizeComparableLabel(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/gu, '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim() ?? ''
}

function resolveOutcomeTextColor(
  label: string,
  accent: EventOrderPanelOutcomeSelectedAccent | null,
  sportsTeams: SportsTeam[] | null,
) {
  const accentColor = accent?.overlayStyle?.backgroundColor ?? accent?.buttonStyle?.backgroundColor
  if (typeof accentColor === 'string' && accentColor.trim()) {
    return accentColor
  }

  const normalizedLabel = normalizeComparableLabel(label)
  const matchingTeam = sportsTeams?.find((team) => {
    return [team.name, team.abbreviation].some((candidate) => {
      const normalizedCandidate = normalizeComparableLabel(candidate)
      return normalizedCandidate.length >= 3
        && (
          normalizedLabel === normalizedCandidate
          || normalizedLabel.includes(normalizedCandidate)
          || normalizedCandidate.includes(normalizedLabel)
        )
    })
  })
  return normalizeHexColor(matchingTeam?.color)
}

function AnimatedCurrency({ value }: { value: number }) {
  return (
    <span className="inline-flex items-baseline">
      <span>$</span>
      <AnimatedCounter
        value={Math.max(0, value)}
        color="currentColor"
        fontSize="30px"
        includeCommas
        includeDecimals
        decimalPrecision={2}
        incrementColor="currentColor"
        decrementColor="currentColor"
        digitStyles={{ fontWeight: 700, lineHeight: '1' }}
        containerStyles={{
          display: 'inline-flex',
          alignItems: 'baseline',
          flexDirection: 'row-reverse',
          lineHeight: '1',
        }}
      />
    </span>
  )
}

function findPercentForAmount(quote: OutcomeArbitrageQuote, amount: number) {
  if (!(amount > 0) || !(quote.totalCost > 0)) {
    return 0
  }
  if (amount >= quote.totalCost) {
    return 100
  }

  let low = 0
  let high = 100
  for (let index = 0; index < 24; index += 1) {
    const middle = (low + high) / 2
    const candidate = scaleOutcomeArbitrageQuote(quote, middle)
    if ((candidate?.totalCost ?? 0) < amount) {
      low = middle
    }
    else {
      high = middle
    }
  }
  return (low + high) / 2
}

export default function EventOrderPanelOutcomeArbitrage({
  market,
  yesOutcomeLabel,
  noOutcomeLabel,
  yesOutcomeAccent,
  noOutcomeAccent,
  sportsTeams,
  siteWalletReady,
  kuestBalance,
  kuestFeeBps,
  isSubmitting,
  submissionStep,
  onRequireSiteWallet,
  onSubmit,
}: EventOrderPanelOutcomeArbitrageProps) {
  const t = useExtracted()
  const [amountPreset, setAmountPreset] = useState<AmountPreset | null>(null)
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const [validationWarning, setValidationWarning] = useState<'minimum' | 'balance' | 'liquidity' | null>(null)
  const previousMarketOpportunityRef = useRef<boolean | null>(null)
  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)
  const yesOutcomeTextColor = resolveOutcomeTextColor(yesOutcomeLabel, yesOutcomeAccent, sportsTeams)
  const noOutcomeTextColor = resolveOutcomeTextColor(noOutcomeLabel, noOutcomeAccent, sportsTeams)
  const tokenIds = [yesOutcome?.token_id, noOutcome?.token_id]
    .filter((value): value is string => Boolean(value))
  const canQuote = tokenIds.length === 2
  const books = useOrderBookSummaries(tokenIds, { enabled: canQuote, refetchIntervalMs: 5_000 })
  const yesFeeRate = useKuestFeeRate(yesOutcome?.token_id ?? null, { enabled: canQuote })
  const noFeeRate = useKuestFeeRate(noOutcome?.token_id ?? null, { enabled: canQuote })
  const yesAsks = useMemo(
    () => normalizeBookLevels(books.data?.[yesOutcome?.token_id ?? '']?.asks, 'ask'),
    [books.data, yesOutcome?.token_id],
  )
  const noAsks = useMemo(
    () => normalizeBookLevels(books.data?.[noOutcome?.token_id ?? '']?.asks, 'ask'),
    [books.data, noOutcome?.token_id],
  )
  const totalYesFeeBps = yesFeeRate.data == null ? null : kuestFeeBps + yesFeeRate.data
  const totalNoFeeBps = noFeeRate.data == null ? null : kuestFeeBps + noFeeRate.data
  const pricePreview = useMemo(() => buildOutcomeArbitragePreview({
    yesAsks,
    noAsks,
    yesFeeBps: totalYesFeeBps,
    noFeeBps: totalNoFeeBps,
  }), [noAsks, totalNoFeeBps, totalYesFeeBps, yesAsks])

  const quotes = useMemo(() => {
    if (!canQuote || !yesOutcome || !noOutcome || totalYesFeeBps == null || totalNoFeeBps == null) {
      return null
    }
    const input = {
      yesTokenId: yesOutcome.token_id,
      noTokenId: noOutcome.token_id,
      yesAsks,
      noAsks,
      yesFeeBps: totalYesFeeBps,
      noFeeBps: totalNoFeeBps,
    }
    return {
      market: buildOutcomeArbitrageQuote(input),
      executable: siteWalletReady
        ? buildOutcomeArbitrageQuote({ ...input, kuestBalance })
        : null,
    }
  }, [
    canQuote,
    kuestBalance,
    noAsks,
    noOutcome,
    siteWalletReady,
    totalNoFeeBps,
    totalYesFeeBps,
    yesAsks,
    yesOutcome,
  ])

  const marketQuote = quotes?.market ?? null
  const executableQuote = quotes?.executable ?? null
  const isQuoteLoading = canQuote
    && !marketQuote
    && (books.isPending || yesFeeRate.isPending || noFeeRate.isPending)
  const isQuoteError = canQuote
    && !marketQuote
    && !isQuoteLoading
    && (books.isError || yesFeeRate.isError || noFeeRate.isError)
  const quote = siteWalletReady ? executableQuote : marketQuote
  const minimumQuote = useMemo(() => marketQuote
    ? findMinimumExecutableOutcomeArbitrageQuote(marketQuote, {
        minimumShares: MIN_LIMIT_ORDER_SHARES,
        minimumOrderAmount: MIN_MARKET_BUY_AMOUNT,
      })
    : null, [marketQuote])
  const maximumQuote = useMemo(() => quote
    ? constrainOutcomeArbitrageQuoteForKuestFok(
        quote,
        siteWalletReady ? kuestBalance : Number.POSITIVE_INFINITY,
      )
    : null, [kuestBalance, quote, siteWalletReady])
  const minimumAmount = minimumQuote
    ? Math.ceil((minimumQuote.totalCost - BALANCE_COMPARISON_EPSILON) * CURRENCY_SCALE) / CURRENCY_SCALE
    : 0
  const maxAmount = maximumQuote
    ? Math.floor((maximumQuote.totalCost + BALANCE_COMPARISON_EPSILON) * CURRENCY_SCALE) / CURRENCY_SCALE
    : 0
  const midpointAmount = minimumAmount > 0 && maxAmount > 0
    ? (minimumAmount + maxAmount) / 2
    : 0
  const presetAmount = amountPreset === 'min'
    ? minimumAmount
    : amountPreset === 'mid'
      ? midpointAmount
      : amountPreset === 'max'
        ? maxAmount
        : null
  const requestedAmount = Number.parseFloat(amountDraft ?? presetAmount?.toFixed(2) ?? '')
  const effectivePercent = quote && Number.isFinite(requestedAmount)
    ? findPercentForAmount(quote, requestedAmount)
    : 0
  const selectedQuote = useMemo(() => {
    if (!quote) {
      return null
    }
    const scaled = scaleOutcomeArbitrageQuote(quote, effectivePercent)
    return scaled
      ? constrainOutcomeArbitrageQuoteForKuestFok(
          scaled,
          siteWalletReady ? kuestBalance : Number.POSITIVE_INFINITY,
        )
      : null
  }, [effectivePercent, kuestBalance, quote, siteWalletReady])

  const selectedYesPrincipal = selectedQuote?.segments.reduce(
    (total, segment) => total + segment.shares * segment.yesPrice,
    0,
  ) ?? 0
  const selectedNoPrincipal = selectedQuote?.segments.reduce(
    (total, segment) => total + segment.shares * segment.noPrice,
    0,
  ) ?? 0
  const selectedFees = Math.max(0, (selectedQuote?.yesCost ?? 0) - selectedYesPrincipal)
    + Math.max(0, (selectedQuote?.noCost ?? 0) - selectedNoPrincipal)
  const requiredBalance = (selectedQuote?.yesOrder.maximumCost ?? 0)
    + (selectedQuote?.noOrder.maximumCost ?? 0)
    + selectedFees
  const isAmountAboveMax = Number.isFinite(requestedAmount)
    && requestedAmount > maxAmount + BALANCE_COMPARISON_EPSILON
  const selectedQuoteMeetsMinimums = Boolean(
    selectedQuote
    && selectedQuote.shares >= MIN_LIMIT_ORDER_SHARES
    && selectedQuote.yesOrder.maximumCost >= MIN_MARKET_BUY_AMOUNT
    && selectedQuote.noOrder.maximumCost >= MIN_MARKET_BUY_AMOUNT,
  )
  const canSubmitQuote = Boolean(
    siteWalletReady
    && executableQuote
    && !isAmountAboveMax
    && selectedQuoteMeetsMinimums
    && requiredBalance <= kuestBalance + BALANCE_COMPARISON_EPSILON
    && !isQuoteLoading
    && !isQuoteError,
  )
  const selectedReturn = selectedQuote && selectedQuote.totalCost > 0
    ? selectedQuote.profit / selectedQuote.totalCost * 100
    : 0
  const displayQuote = selectedQuote ?? quote ?? marketQuote
  const yesAveragePrice = displayQuote && displayQuote.shares > 0
    ? displayQuote.segments.reduce((total, segment) => total + segment.shares * segment.yesPrice, 0)
    / displayQuote.shares
    : pricePreview?.yesPrice ?? null
  const noAveragePrice = displayQuote && displayQuote.shares > 0
    ? displayQuote.segments.reduce((total, segment) => total + segment.shares * segment.noPrice, 0)
    / displayQuote.shares
    : pricePreview?.noPrice ?? null
  const displayEdge = displayQuote?.edge ?? pricePreview?.edge ?? null
  const hasMarketOpportunity = Boolean(marketQuote)
  const shouldShakePriceDifference = hasMarketOpportunity && previousMarketOpportunityRef.current === false
  const amountInputValue = amountDraft
    ?? presetAmount?.toFixed(2)
    ?? selectedQuote?.totalCost.toFixed(2)
    ?? '0.00'

  useEffect(() => {
    previousMarketOpportunityRef.current = hasMarketOpportunity
  }, [hasMarketOpportunity])

  function handleAmountChange(rawValue: string) {
    setValidationWarning(null)
    setAmountPreset(null)
    setAmountDraft(sanitizeNumericInput(rawValue))
  }

  function handleAmountBlur() {
    const amount = Number.parseFloat(amountDraft ?? '')
    if (Number.isFinite(amount) && amount > maxAmount) {
      setAmountDraft(maxAmount.toFixed(2))
    }
  }

  function handleSubmit() {
    const displayedAmount = Number.parseFloat(amountInputValue)
    if (marketQuote && !minimumQuote) {
      setValidationWarning('liquidity')
      return
    }
    if (Number.isFinite(displayedAmount) && displayedAmount > maxAmount + BALANCE_COMPARISON_EPSILON) {
      setValidationWarning('balance')
      return
    }
    if (
      !selectedQuote
      || selectedQuote.shares < MIN_LIMIT_ORDER_SHARES
      || selectedQuote.yesOrder.maximumCost < MIN_MARKET_BUY_AMOUNT
      || selectedQuote.noOrder.maximumCost < MIN_MARKET_BUY_AMOUNT
    ) {
      setValidationWarning('minimum')
      return
    }
    if (requiredBalance > kuestBalance + BALANCE_COMPARISON_EPSILON) {
      setValidationWarning('balance')
      return
    }
    setValidationWarning(null)
    onSubmit(selectedQuote)
  }

  const submitButtonLabel = submissionStep === 1
    ? t('Sign {outcome} order · 1/2', { outcome: yesOutcomeLabel })
    : submissionStep === 2
      ? t('Sign {outcome} order · 2/2', { outcome: noOutcomeLabel })
      : submissionStep === 3
        ? t('Submitting orders…')
        : isQuoteLoading
          ? t('Loading...')
          : isQuoteError
            ? t('Trade unavailable')
            : !hasMarketOpportunity
                ? t('No profitable trade right now')
                : !executableQuote
                    ? t('Insufficient USDC balance')
                    : !minimumQuote
                        ? t('No liquidity for this market order')
                        : isAmountAboveMax
                          ? t('Max: {amount}', { amount: formatCurrency(maxAmount) })
                          : !canSubmitQuote
                              ? t('Amount too low')
                              : t('Sign orders · 0/2')
  const submitButton = (
    <EventOrderPanelSubmitButton
      type="button"
      className={cn(canSubmitQuote && submissionStep === 0 && 'animate-arbitrage-glow')}
      isLoading={isSubmitting}
      isDisabled={isSubmitting || !canSubmitQuote}
      onClick={handleSubmit}
      label={submitButtonLabel}
      loadingLabel={submitButtonLabel}
    />
  )
  const submitButtonWithStatus = !hasMarketOpportunity
    && !isQuoteLoading
    && !isQuoteError
    && submissionStep === 0
    ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="block" tabIndex={0}>{submitButton}</div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-72 text-center">
            {t('Arbitrage is available when opposite outcomes cost less than their combined $1 payout, including fees.')}
          </TooltipContent>
        </Tooltip>
      )
    : submitButton

  if (!canQuote) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        {t('This market needs both YES and NO outcomes for arbitrage.')}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-secondary dark:bg-background">
          <div className="
            grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary p-1 text-sm
            dark:bg-background
          "
          >
            <div className="flex min-h-15 items-center justify-between gap-2 rounded-xl bg-card p-2 dark:bg-secondary">
              <span
                className="min-w-0 truncate text-base font-semibold text-yes"
                style={{ color: yesOutcomeTextColor ?? undefined }}
              >
                {yesOutcomeLabel}
              </span>
              <span className="shrink-0">
                {yesAveragePrice != null
                  ? <EventOrderPanelAnimatedCents value={yesAveragePrice * 100} fontSize="20px" />
                  : '—'}
              </span>
            </div>
            <div className="flex min-h-15 items-center justify-between gap-2 rounded-xl bg-card p-2 dark:bg-secondary">
              <span
                className="min-w-0 truncate text-base font-semibold text-no"
                style={{ color: noOutcomeTextColor ?? undefined }}
              >
                {noOutcomeLabel}
              </span>
              <span className="shrink-0">
                {noAveragePrice != null
                  ? <EventOrderPanelAnimatedCents value={noAveragePrice * 100} fontSize="20px" />
                  : '—'}
              </span>
            </div>
          </div>
          <div className={cn(
            'flex items-center justify-between gap-3 px-4 py-3 text-sm',
            shouldShakePriceDifference && 'animate-order-shake',
          )}
          >
            <span className="text-muted-foreground">{t('Profit per share')}</span>
            <div className={cn(
              'flex items-center gap-1.5 font-semibold',
              displayEdge == null
                ? 'text-muted-foreground'
                : displayEdge > 0 ? 'text-yes' : 'text-no',
            )}
            >
              {displayEdge != null
                ? (
                    <>
                      <span>≈</span>
                      {displayEdge < 0 && <span>−</span>}
                      <EventOrderPanelAnimatedCents value={Math.abs(displayEdge) * 100} fontSize="18px" />
                    </>
                  )
                : <span>—</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <InfoIcon className="size-4" />
                    <span className="sr-only">{t('Execution risk')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" className="max-w-64 text-xs">
                  {t('Estimated profit for each matched pair of shares, after fees, based on current executable prices.')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-3">
          <div className="shrink-0">
            <label htmlFor="outcome-arbitrage-amount" className="text-lg font-medium">{t('Amount')}</label>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(minimumAmount)}
              {' '}
              {t('Min').toLocaleLowerCase()}
              {' · '}
              {formatCurrency(maxAmount)}
              {' '}
              {t('Max').toLocaleLowerCase()}
            </div>
          </div>
          <input
            id="outcome-arbitrage-amount"
            type="text"
            inputMode="decimal"
            value={`$${formatDisplayAmount(amountInputValue)}`}
            onChange={event => handleAmountChange(event.currentTarget.value)}
            onBlur={handleAmountBlur}
            className={cn(
              `
                h-14 w-full border-0 bg-transparent text-right font-semibold text-slate-700 outline-hidden
                dark:text-slate-300
              `,
              getAmountSizeClass(amountInputValue),
            )}
          />
        </div>

        <div className="mb-3 flex justify-end gap-2">
          {([
            { key: 'min' as const, label: t('Min'), amount: minimumAmount },
            { key: 'mid' as const, label: t('Mid'), amount: midpointAmount },
            { key: 'max' as const, label: t('Max'), amount: maxAmount },
          ]).map(preset => (
            <Button
              key={preset.key}
              type="button"
              size="sm"
              variant="outline"
              disabled={!siteWalletReady}
              className={cn(
                'text-xs',
                amountPreset === preset.key && 'border-primary bg-primary/10 text-primary',
              )}
              onClick={() => {
                setValidationWarning(null)
                if (amountPreset === preset.key) {
                  setAmountDraft(preset.amount.toFixed(2))
                  setAmountPreset(null)
                  return
                }
                setAmountDraft(null)
                setAmountPreset(preset.key)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mb-4">
          <hr className="mb-3 border" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-foreground">{t('Payout')}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {t('Est. profit')}
                  {' '}
                  {selectedQuote?.profit ? '+' : ''}
                  {formatCurrency(selectedQuote?.profit ?? 0)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-4 items-center justify-center hover:text-foreground"
                    >
                      <InfoIcon className="size-3" />
                      <span className="sr-only">{t('Est. profit')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="w-64 overflow-hidden rounded-2xl border border-border bg-background p-0"
                  >
                    <div className="grid gap-2 rounded-2xl border border-border bg-card px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span>{t('Payout')}</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedQuote?.payout ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{t('{venue} cost', { venue: yesOutcomeLabel })}</span>
                        <span>
                          −
                          {formatCurrency(selectedYesPrincipal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{t('{venue} cost', { venue: noOutcomeLabel })}</span>
                        <span>
                          −
                          {formatCurrency(selectedNoPrincipal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-muted-foreground">
                        <span>{t('Est. fees')}</span>
                        <span>
                          −
                          {formatCurrency(selectedFees)}
                        </span>
                      </div>
                      <hr className="border-border" />
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span>{t('Est. profit')}</span>
                        <span className="text-yes">
                          {selectedQuote?.profit ? '+' : ''}
                          {formatCurrency(selectedQuote?.profit ?? 0)}
                          {' ('}
                          {selectedReturn.toFixed(1)}
                          %)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      {t('Based on current executable prices.')}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className={cn(
              'text-3xl font-bold',
              selectedQuote?.payout ? 'text-yes' : 'text-muted-foreground',
            )}
            >
              <AnimatedCurrency value={selectedQuote?.payout ?? 0} />
            </div>
          </div>
        </div>
      </div>

      {validationWarning && (
        <div className="
          flex animate-order-shake items-center justify-center gap-2 text-xs font-semibold text-orange-500
          sm:text-sm
        "
        >
          <TriangleAlertIcon className="size-4" />
          {validationWarning === 'balance'
            ? t('Insufficient USDC balance')
            : validationWarning === 'liquidity'
              ? t('No liquidity for this market order')
              : t('Min. amount at current prices: {amount}', { amount: formatCurrency(minimumAmount) })}
        </div>
      )}

      {!siteWalletReady
        ? (
            <EventOrderPanelSubmitButton
              type="button"
              isLoading={false}
              isDisabled={false}
              onClick={onRequireSiteWallet}
              label={t('Trade')}
            />
          )
        : submitButtonWithStatus}
    </div>
  )
}
