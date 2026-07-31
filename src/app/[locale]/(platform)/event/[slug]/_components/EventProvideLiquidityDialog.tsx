'use client'

import type { InfiniteData } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'
import { BotIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import { useSignTypedData } from 'wagmi'

import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { SubmitOrderArgs } from '@/lib/orders'
import type { Market } from '@/types'

import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import ResponsiveTradingDialog from '@/app/[locale]/(platform)/event/[slug]/_components/ResponsiveTradingDialog'
import { buildUserOpenOrdersQueryKey } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/toast'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY, useBalance } from '@/hooks/useBalance'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { Link } from '@/i18n/navigation'
import { MAX_AMOUNT_INPUT } from '@/lib/amount-input'
import { addressToBuilderCode } from '@/lib/builder-code'
import {
  CLOB_ORDER_TYPE,
  DEFAULT_CONDITION_PARTITION,
  getExchangeEip712Domain,
  ORDER_SIDE,
  ORDER_TYPE,
  OUTCOME_INDEX,
} from '@/lib/constants'
import { ZERO_BYTES32 } from '@/lib/contracts'
import { toMicro } from '@/lib/formatters'
import {
  buildLiquidityLadder,
  canProvideMarketLiquidity,
  getLiquidityLadderRequirements,
  MAX_LIQUIDITY_LADDER_LEVELS,
} from '@/lib/liquidity-ladder'
import { isCurrentNegRiskAdapterAddress, resolveNegRiskAdapterAddressFromMetadata } from '@/lib/neg-risk-adapter'
import {
  buildOptimisticOpenOrder,
  prependOpenOrderToInfiniteData,
  updateQueryDataWhere,
} from '@/lib/optimistic-trading'
import { buildOrderPayload, submitOrders } from '@/lib/orders'
import { signOrderPayload } from '@/lib/orders/signing'
import { MIN_LIMIT_ORDER_SHARES } from '@/lib/orders/validation'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { refreshTradingPositionsAfterMutation } from '@/lib/trading-cache'
import { cn } from '@/lib/utils'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildNegRiskSplitPositionCall, buildSplitPositionCall } from '@/lib/wallet/transactions'
import { useUser } from '@/stores/useUser'

interface EventProvideLiquidityDialogProps {
  open: boolean
  market: Market
  eventSlug: string
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type NumericDraftSetter = (value: string) => void

function sanitizeDecimalDraft(rawValue: string, setValue: NumericDraftSetter) {
  const normalized = rawValue.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const [whole = '', ...fractionParts] = normalized.split('.')
  const fraction = fractionParts.join('').slice(0, 2)
  const nextValue = fractionParts.length > 0 ? `${whole.slice(0, 9)}.${fraction}` : whole.slice(0, 9)
  const numericValue = Number.parseFloat(nextValue)

  if (!Number.isFinite(numericValue) || numericValue <= MAX_AMOUNT_INPUT) {
    setValue(nextValue)
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isWholeCentAmount(value: number) {
  const scaled = value * 100
  return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-8
}

export default function EventProvideLiquidityDialog({
  open,
  market,
  eventSlug,
  onOpenChange,
  onSuccess,
}: EventProvideLiquidityDialogProps) {
  const t = useExtracted()
  const queryClient = useQueryClient()
  const user = useUser()
  const { open: openAppKit } = useAppKit()
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const { balance, isLoadingBalance } = useBalance({ enabled: open })
  const affiliateMetadata = useAffiliateOrderMetadata()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const [splitAmount, setSplitAmount] = useState('15')
  const [depth, setDepth] = useState('5')
  const [centerPriceCents, setCenterPriceCents] = useState(50)
  const [levelsPerSide, setLevelsPerSide] = useState(3)
  const [priceStepCents, setPriceStepCents] = useState(2)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signatureProgress, setSignatureProgress] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const yesOutcome = market.outcomes.find((outcome) => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes.find((outcome) => outcome.outcome_index === OUTCOME_INDEX.NO)
  const primaryOutcomeLabel = yesOutcome
    ? normalizeOutcomeLabel(yesOutcome.outcome_text) || yesOutcome.outcome_text
    : ''
  const secondaryOutcomeLabel = noOutcome ? normalizeOutcomeLabel(noOutcome.outcome_text) || noOutcome.outcome_text : ''
  const numericSplitAmount = Number.parseFloat(splitAmount)
  const numericDepth = Number.parseFloat(depth)
  const ladderOrders = useMemo(
    () =>
      buildLiquidityLadder({
        centerPriceCents,
        levelsPerSide,
        priceStepCents,
        sharesPerOrder: numericDepth,
      }),
    [centerPriceCents, levelsPerSide, numericDepth, priceStepCents],
  )
  const requirements = useMemo(() => getLiquidityLadderRequirements(ladderOrders), [ladderOrders])
  const requiredBalance = (Number.isFinite(numericSplitAmount) ? numericSplitAmount : 0) + requirements.bidCost
  const noPriceCents = 100 - centerPriceCents
  const primaryOrders = ladderOrders.filter((order) => order.outcomeIndex === OUTCOME_INDEX.YES)
  const secondaryOrders = ladderOrders.filter((order) => order.outcomeIndex === OUTCOME_INDEX.NO)
  const builderCode = addressToBuilderCode(affiliateMetadata.referrerAddress)
  const negRiskAdapterAddress = resolveNegRiskAdapterAddressFromMetadata(market.metadata, market.condition?.oracle)
  const isNegRiskMarket = Boolean(market.neg_risk || isCurrentNegRiskAdapterAddress(negRiskAdapterAddress))
  const availableBalance = Number.isFinite(balance.raw) ? Math.max(0, balance.raw) : 0
  const hasDepositWallet = Boolean(user?.deposit_wallet_address)
  const hasInsufficientBalance = Boolean(
    hasDepositWallet && !isLoadingBalance && requiredBalance > availableBalance + 1e-8,
  )

  const validationError = (() => {
    if (!yesOutcome?.token_id || !noOutcome?.token_id) {
      return t('This market cannot be used for liquidity provisioning.')
    }
    if (!Number.isFinite(numericSplitAmount) || numericSplitAmount <= 0 || !isWholeCentAmount(numericSplitAmount)) {
      return t('Enter a split amount in whole cents.')
    }
    if (!Number.isFinite(numericDepth) || numericDepth < MIN_LIMIT_ORDER_SHARES) {
      return t('Depth must be at least {minimum} shares.', {
        minimum: MIN_LIMIT_ORDER_SHARES.toString(),
      })
    }
    if (requirements.splitShares > numericSplitAmount + 1e-8) {
      return t('Split at least {amount} to cover the sell orders.', {
        amount: formatCurrency(requirements.splitShares),
      })
    }
    if (isNegRiskMarket && !isCurrentNegRiskAdapterAddress(negRiskAdapterAddress)) {
      return t('This action is currently unavailable for this market.')
    }
    if (hasInsufficientBalance) {
      return t('You need {required} available for the split and buy orders.', {
        required: formatCurrency(requiredBalance),
      })
    }
    return null
  })()

  function resetForm() {
    setSplitAmount('15')
    setDepth('5')
    setCenterPriceCents(50)
    setLevelsPerSide(3)
    setPriceStepCents(2)
    setIsSubmitting(false)
    setSignatureProgress(0)
    setIsPreviewOpen(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) {
      return
    }
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    if (validationError || !yesOutcome || !noOutcome || !canProvideMarketLiquidity(market, Date.now())) {
      if (!validationError) {
        toast.error(t('This market is no longer accepting liquidity.'))
      }
      return
    }
    if (!ensureTradingReady()) {
      return
    }

    const makerAddress = normalizeAddress(user?.deposit_wallet_address)
    if (!user || !makerAddress) {
      openTradeRequirements({ forceTradingAuth: true })
      return
    }
    const userId = user.id

    const totalSignatures = requirements.signatureCount
    setSignatureProgress(0)
    setIsSubmitting(true)

    try {
      const orderDomain = getExchangeEip712Domain(isNegRiskMarket)
      const signedOrders: SubmitOrderArgs[] = []

      for (const [index, ladderOrder] of ladderOrders.entries()) {
        const orderOutcome = ladderOrder.outcomeIndex === OUTCOME_INDEX.YES ? yesOutcome : noOutcome
        const payload = buildOrderPayload({
          makerAddress,
          outcome: orderOutcome,
          side: ladderOrder.side === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL,
          orderType: ORDER_TYPE.LIMIT,
          amount: '',
          limitPrice: ladderOrder.priceCents.toString(),
          limitShares: ladderOrder.shares.toString(),
          builder: builderCode,
        })
        const signatureNumber = index + 1
        const signature = await runWithSignaturePrompt(
          () =>
            signOrderPayload({
              payload,
              domain: orderDomain,
              signTypedDataAsync,
            }),
          {
            title: t('Sign order · {current}/{total}', {
              current: signatureNumber.toString(),
              total: totalSignatures.toString(),
            }),
          },
        )

        signedOrders.push({
          order: payload,
          signature,
          orderType: ORDER_TYPE.LIMIT,
          clobOrderType: CLOB_ORDER_TYPE.GTC,
          postOnly: true,
          conditionId: market.condition_id,
          slug: eventSlug,
        })
        setSignatureProgress(signatureNumber)
      }

      const splitCall = isNegRiskMarket
        ? buildNegRiskSplitPositionCall({
            conditionId: market.condition_id as `0x${string}`,
            amount: toMicro(numericSplitAmount),
            contract: negRiskAdapterAddress ?? undefined,
          })
        : buildSplitPositionCall({
            conditionId: market.condition_id as `0x${string}`,
            partition: [...DEFAULT_CONDITION_PARTITION],
            amount: toMicro(numericSplitAmount),
            parentCollectionId: ZERO_BYTES32,
          })

      const splitResponse = await runWithSignaturePrompt(
        (dismissPrompt, restorePrompt) =>
          signAndSubmitDepositWalletCalls({
            user,
            calls: [splitCall],
            metadata: 'provide_liquidity_split',
            signTypedDataAsync,
            onSigning: restorePrompt,
            onSigned: dismissPrompt,
          }),
        {
          title: t('Sign split · {current}/{total}', {
            current: totalSignatures.toString(),
            total: totalSignatures.toString(),
          }),
        },
      )

      if (splitResponse.error) {
        if (isTradingAuthRequiredError(splitResponse.error)) {
          resetForm()
          onOpenChange(false)
          openTradeRequirements({ forceTradingAuth: true })
          return
        }
        if (splitResponse.code === 'wallet_connector_not_connected') {
          toast.error(splitResponse.error)
          void openAppKit({ view: 'Connect' })
          return
        }
        toast.error(splitResponse.error)
        return
      }
      setSignatureProgress(totalSignatures)

      const result = await submitOrders(signedOrders)
      if (result.error) {
        if (isTradingAuthRequiredError(result.error)) {
          resetForm()
          onOpenChange(false)
          openTradeRequirements({ forceTradingAuth: true })
          return
        }
        toast.error(result.error)
        return
      }

      const failedOrders = result.results?.filter((orderResult) => orderResult.error) ?? []
      const successfulOrders = (result.results?.length ?? 0) - failedOrders.length
      const openOrdersQueryKey = buildUserOpenOrdersQueryKey(userId, eventSlug, market.condition_id)
      const eventOpenOrdersQueryKey = buildUserOpenOrdersQueryKey(userId, eventSlug)

      result.results?.forEach((orderResult, index) => {
        if (orderResult.error) {
          return
        }

        const ladderOrder = ladderOrders[index]
        const orderOutcome = ladderOrder.outcomeIndex === OUTCOME_INDEX.YES ? yesOutcome : noOutcome
        const optimisticOrder = buildOptimisticOpenOrder({
          id: orderResult.orderId ?? signedOrders[index].order.salt.toString(),
          side: ladderOrder.side,
          type: CLOB_ORDER_TYPE.GTC,
          price: ladderOrder.priceCents / 100,
          shares: ladderOrder.shares,
          totalValue: (ladderOrder.shares * ladderOrder.priceCents) / 100,
          outcomeIndex: ladderOrder.outcomeIndex,
          outcomeText: orderOutcome.outcome_text,
          conditionId: market.condition_id,
          marketTitle: market.short_title || market.title,
          marketSlug: market.slug,
          eventSlug,
          iconUrl: market.icon_url,
        })

        queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[]; next_cursor: string }>>(
          openOrdersQueryKey,
          (current) => prependOpenOrderToInfiniteData(current, optimisticOrder),
        )
        queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[]; next_cursor: string }>>(
          eventOpenOrdersQueryKey,
          (current) => prependOpenOrderToInfiniteData(current, optimisticOrder),
        )
        updateQueryDataWhere<InfiniteData<{ data: PortfolioUserOpenOrder[]; next_cursor: string }>>(
          queryClient,
          ['public-open-orders', makerAddress],
          (currentQueryKey) => currentQueryKey[1] === makerAddress,
          (current) => prependOpenOrderToInfiniteData(current, optimisticOrder),
        )
      })

      refreshTradingPositionsAfterMutation(queryClient)
      function refreshOpenOrdersAndBooks() {
        return Promise.all([
          queryClient.invalidateQueries({
            queryKey: openOrdersQueryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: eventOpenOrdersQueryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: ['public-open-orders', makerAddress],
          }),
          queryClient.invalidateQueries({
            queryKey: ['orderbook-summary'],
          }),
          queryClient.invalidateQueries({
            queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY],
          }),
        ])
      }
      void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
      for (const delay of [15_000, 60_000]) {
        globalThis.setTimeout(() => {
          void refreshOpenOrdersAndBooks()
        }, delay)
      }

      if (failedOrders.length > 0) {
        toast.warning(
          t('{successful} of {total} liquidity orders were added.', {
            successful: successfulOrders.toString(),
            total: ladderOrders.length.toString(),
          }),
        )
      } else {
        toast.success(
          t('Liquidity added with {count} orders.', {
            count: ladderOrders.length.toString(),
          }),
        )
      }

      onSuccess?.()
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to provide liquidity.', error)
      if (isUserRejectedRequestError(error)) {
        toast.info(t('Liquidity signing was cancelled. Split shares may already be in your wallet.'))
      } else {
        toast.error(t('We could not add liquidity. Please check your positions and try again.'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveTradingDialog open={open} title={t('Provide initial liquidity')} onOpenChange={handleOpenChange}>
      <div className="grid max-h-[62vh] gap-5 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <LiquidityInput
            id="liquidity-split-amount"
            label={t({
              id: '0Z0dyp',
              message: 'Amount to split',
            })}
            value={splitAmount}
            suffix="USDC"
            disabled={isSubmitting}
            onChange={(value) => sanitizeDecimalDraft(value, setSplitAmount)}
          />
          <LiquidityInput
            id="liquidity-depth"
            label={t({
              id: 'PA6So0',
              message: 'Shares per level',
            })}
            value={depth}
            suffix={t({
              id: 'liquidityShareCount',
              message: '{count, plural, one {share} other {shares}}',
              values: {
                count: Number.isFinite(numericDepth) ? numericDepth : 0,
              },
            })}
            disabled={isSubmitting}
            onChange={(value) => sanitizeDecimalDraft(value, setDepth)}
          />
          <LiquidityIntegerInput
            id="liquidity-levels"
            label={t('Levels per side')}
            value={levelsPerSide}
            maximum={MAX_LIQUIDITY_LADDER_LEVELS}
            disabled={isSubmitting}
            onChange={setLevelsPerSide}
          />
          <LiquidityIntegerInput
            id="liquidity-price-step"
            label={t('Price step')}
            value={priceStepCents}
            maximum={25}
            suffix="¢"
            disabled={isSubmitting}
            onChange={setPriceStepCents}
          />
        </div>

        <div className="space-y-2">
          <Slider
            min={1}
            max={99}
            step={1}
            value={centerPriceCents}
            disabled={isSubmitting}
            thumbAriaLabel={t('Starting chance')}
            trackClassName="h-2 bg-transparent"
            indicatorClassName="hidden"
            thumbClassName="border-2 border-background bg-foreground"
            trackStyle={{
              background: `
                linear-gradient(
                  to right,
                  var(--yes) 0%,
                  var(--yes) ${Math.max(0, centerPriceCents - 1)}%,
                  var(--no) ${Math.min(100, centerPriceCents + 1)}%,
                  var(--no) 100%
                )
              `,
            }}
            onValueChange={setCenterPriceCents}
          />
          <div className="grid grid-cols-3 text-[11px] font-semibold">
            <span className="truncate text-yes">
              {primaryOutcomeLabel} {centerPriceCents}¢
            </span>
            <span className="text-center text-muted-foreground">50¢</span>
            <span className="truncate text-right text-no">
              {secondaryOutcomeLabel} {noPriceCents}¢
            </span>
          </div>
        </div>

        <Accordion
          value={isPreviewOpen ? ['order-book-preview'] : []}
          className="rounded-xl border"
          onValueChange={(value) => setIsPreviewOpen(value[0] === 'order-book-preview')}
        >
          <AccordionItem value="order-book-preview" className="border-0">
            <AccordionTrigger className="cursor-pointer px-3 py-2.5 text-xs font-semibold hover:no-underline">
              <span>
                {t('Order Book')}
                {' · '}
                {t('Preview')}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 [&>div]:pb-3">
              <div className="grid grid-cols-2 gap-3">
                <SimulatedOrderBook
                  outcomeLabel={primaryOutcomeLabel}
                  centerPriceCents={centerPriceCents}
                  orders={primaryOrders}
                />
                <SimulatedOrderBook
                  outcomeLabel={secondaryOutcomeLabel}
                  centerPriceCents={noPriceCents}
                  orders={secondaryOrders}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div
          className={cn(
            'space-y-2',
            isPreviewOpen && 'sticky bottom-0 z-20 -mx-1 bg-background/95 px-1 py-2 backdrop-blur-sm',
          )}
        >
          {validationError && (
            <div
              className={cn(
                `flex animate-order-shake items-center justify-center gap-2 text-center text-sm font-semibold text-orange-500`,
              )}
            >
              <TriangleAlertIcon className="size-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <Button
            type="button"
            size="outcome"
            className="w-full text-base font-bold"
            disabled={isSubmitting || isLoadingBalance || Boolean(validationError)}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? t({
                  id: '01kCpU',
                  message: 'Signing orders · {current}/{total}',
                  values: {
                    current: signatureProgress.toString(),
                    total: requirements.signatureCount.toString(),
                  },
                })
              : t({
                  id: 'qvOJx8',
                  message: 'Split & create {count, plural, one {# order} other {# orders}}',
                  values: { count: ladderOrders.length },
                })}
          </Button>
        </div>

        <div className="flex items-start gap-2 border-t pt-3 text-[11px]/relaxed text-muted-foreground">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border">
            <BotIcon className="size-5" />
          </span>
          <p>
            {t.rich({
              id: 'B5xQfU',
              message:
                'For ongoing liquidity, use a <bot>market-making bot</bot>.<br></br>This tool is intended for seeding low-volume markets.',
              values: {
                bot: (chunks) => (
                  <Link
                    href="/settings/sdks"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    {chunks}
                  </Link>
                ),
                br: () => <br />,
              },
            })}
          </p>
        </div>
      </div>
    </ResponsiveTradingDialog>
  )
}

function LiquidityInput({
  id,
  label,
  value,
  suffix,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  suffix: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          inputMode="decimal"
          disabled={disabled}
          className="h-11 pr-14"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-2xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  )
}

function LiquidityIntegerInput({
  id,
  label,
  value,
  maximum,
  suffix,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: number
  maximum: number
  suffix?: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={1}
          max={maximum}
          step={1}
          value={value}
          disabled={disabled}
          className={cn('h-11', suffix && 'pr-8')}
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (Number.isFinite(nextValue)) {
              onChange(Math.min(maximum, Math.max(1, Math.round(nextValue))))
            }
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function SimulatedOrderBook({
  outcomeLabel,
  centerPriceCents,
  orders,
}: {
  outcomeLabel: string
  centerPriceCents: number
  orders: Array<{ side: 'buy' | 'sell'; priceCents: number; shares: number }>
}) {
  const t = useExtracted()
  const asks = buildCumulativePreviewRows(orders, 'sell')
  const bids = buildCumulativePreviewRows(orders, 'buy')
  const maximumCumulativeValue = Math.max(
    0,
    ...asks.map((order) => order.cumulativeValue),
    ...bids.map((order) => order.cumulativeValue),
  )

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="truncate border-b bg-muted/40 px-3 py-2 text-center text-xs font-semibold" title={outcomeLabel}>
        {outcomeLabel}
      </div>
      <div className="grid grid-cols-2 border-b px-2 py-1.5 text-2xs font-medium text-muted-foreground">
        <span>{t('Price')}</span>
        <span className="text-right">{t('Total')}</span>
      </div>
      {asks.map((order) => (
        <SimulatedOrderBookRow
          key={`ask-${order.priceCents}`}
          order={order}
          maximumCumulativeValue={maximumCumulativeValue}
        />
      ))}
      <div className="flex items-center justify-center border-y bg-muted/50 py-1.5 text-xs font-bold">
        {centerPriceCents}¢
      </div>
      {bids.map((order) => (
        <SimulatedOrderBookRow
          key={`bid-${order.priceCents}`}
          order={order}
          maximumCumulativeValue={maximumCumulativeValue}
        />
      ))}
    </div>
  )
}

function SimulatedOrderBookRow({
  order,
  maximumCumulativeValue,
}: {
  order: CumulativePreviewRow
  maximumCumulativeValue: number
}) {
  const widthPercentage =
    maximumCumulativeValue > 0 ? Math.max(12, (order.cumulativeValue / maximumCumulativeValue) * 100) : 0

  return (
    <div className="relative grid grid-cols-2 px-2 py-1.5 text-xs">
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0', order.side === 'buy' ? 'bg-yes/8' : 'bg-no/8')}
        style={{ width: `${widthPercentage}%` }}
      />
      <span className={cn('relative font-semibold', order.side === 'buy' ? 'text-yes' : 'text-no')}>
        {order.priceCents}¢
      </span>
      <span className="relative text-right text-foreground">{formatCurrency(order.cumulativeValue)}</span>
    </div>
  )
}

interface CumulativePreviewRow {
  side: 'buy' | 'sell'
  priceCents: number
  cumulativeValue: number
}

function buildCumulativePreviewRows(
  orders: Array<{ side: 'buy' | 'sell'; priceCents: number; shares: number }>,
  side: 'buy' | 'sell',
): CumulativePreviewRow[] {
  const sideOrders = orders.filter((order) => order.side === side)
  const innerToOuter = [...sideOrders].sort((left, right) =>
    side === 'sell' ? left.priceCents - right.priceCents : right.priceCents - left.priceCents,
  )
  const cumulativeValueByPrice = new Map<number, number>()
  let cumulativeValue = 0

  innerToOuter.forEach((order) => {
    cumulativeValue += (order.shares * order.priceCents) / 100
    cumulativeValueByPrice.set(order.priceCents, cumulativeValue)
  })

  return [...sideOrders]
    .sort((left, right) => right.priceCents - left.priceCents)
    .map((order) => ({
      side: order.side,
      priceCents: order.priceCents,
      cumulativeValue: Number((cumulativeValueByPrice.get(order.priceCents) ?? 0).toFixed(6)),
    }))
}
