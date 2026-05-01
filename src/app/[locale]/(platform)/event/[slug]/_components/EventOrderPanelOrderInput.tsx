'use client'

import type { RefObject } from 'react'
import type { EventOrderPanelOutcomeSelectedAccent } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import type { useBalance } from '@/hooks/useBalance'
import type { OUTCOME_INDEX } from '@/lib/constants'
import type { LimitExpirationOption } from '@/stores/useOrder'
import { TriangleAlertIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import EventOrderPanelEarnings from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelEarnings'
import EventOrderPanelInput from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelInput'
import EventOrderPanelLimitControls from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelLimitControls'
import EventOrderPanelSubmitButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelSubmitButton'
import EventOrderPanelUserShares from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelUserShares'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderPanelOrderInputProps {
  isMobile: boolean
  side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  isLimitOrder: boolean
  amount: string
  amountNumber: number
  availableShares: number
  availableYesTokenShares: number
  availableNoTokenShares: number
  availableYesPositionShares: number
  availableNoPositionShares: number
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | undefined
  balance: ReturnType<typeof useBalance>['balance']
  isBalanceLoading: boolean
  inputRef: RefObject<HTMLInputElement | null>
  shouldShakeInput: boolean
  shouldShowEarnings: boolean
  sellAmountLabel: string
  avgSellPriceLabel: string
  avgBuyPriceLabel: string
  avgSellPriceCentsValue: number | null
  avgBuyPriceCentsValue: number | null
  buyPayoutSummary: {
    payout: number
    cost: number
    profit: number
    changePct: number
    multiplier: number
  }
  shouldShowResolvedMarketMinimumWarning: boolean
  shouldShowResolvedNoLiquidityWarning: boolean
  showInsufficientSharesWarning: boolean
  showInsufficientBalanceWarning: boolean
  showAmountTooLowWarning: boolean
  feePreview: {
    platformMakerFee: number
    platformTakerFee: number
    builderMakerFee: number
    builderTakerFee: number
    totalMakerFee: number
    totalTakerFee: number
  } | null
  isFeePreviewLoading: boolean
  limitPrice: string
  limitShares: string
  limitExpirationEnabled: boolean
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null
  limitMatchingShares: number | null
  shouldShowLimitMinimumWarning: boolean
  shouldShakeLimitShares: boolean
  limitSharesRef: RefObject<HTMLInputElement | null>
  onAmountChange: (nextAmount: string) => void
  onLimitPriceChange: (nextLimitPrice: string) => void
  onLimitSharesChange: (nextLimitShares: string) => void
  onLimitExpirationEnabledChange: (enabled: boolean) => void
  onLimitExpirationOptionChange: (option: LimitExpirationOption) => void
  onLimitExpirationTimestampChange: (timestamp: number | null) => void
  onAmountUpdateFromLimit: (amount: string) => void
  isInteractiveWalletReady: boolean
  shouldShowDepositCta: boolean
  isLoading: boolean
  selectedSubmitAccent: EventOrderPanelOutcomeSelectedAccent | null
  outcomeButtonStyleVariant: 'default' | 'sports3d'
  submitButtonLabel: string
  onSubmitButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export default function EventOrderPanelOrderInput({
  isMobile,
  side,
  isLimitOrder,
  amount,
  amountNumber,
  availableShares,
  availableYesTokenShares,
  availableNoTokenShares,
  availableYesPositionShares,
  availableNoPositionShares,
  outcomeIndex,
  balance,
  isBalanceLoading,
  inputRef,
  shouldShakeInput,
  shouldShowEarnings,
  sellAmountLabel,
  avgSellPriceLabel,
  avgBuyPriceLabel,
  avgSellPriceCentsValue,
  avgBuyPriceCentsValue,
  buyPayoutSummary,
  shouldShowResolvedMarketMinimumWarning,
  shouldShowResolvedNoLiquidityWarning,
  showInsufficientSharesWarning,
  showInsufficientBalanceWarning,
  showAmountTooLowWarning,
  feePreview,
  isFeePreviewLoading,
  limitPrice,
  limitShares,
  limitExpirationEnabled,
  limitExpirationOption,
  limitExpirationTimestamp,
  limitMatchingShares,
  shouldShowLimitMinimumWarning,
  shouldShakeLimitShares,
  limitSharesRef,
  onAmountChange,
  onLimitPriceChange,
  onLimitSharesChange,
  onLimitExpirationEnabledChange,
  onLimitExpirationOptionChange,
  onLimitExpirationTimestampChange,
  onAmountUpdateFromLimit,
  isInteractiveWalletReady,
  shouldShowDepositCta,
  isLoading,
  selectedSubmitAccent,
  outcomeButtonStyleVariant,
  submitButtonLabel,
  onSubmitButtonClick,
}: EventOrderPanelOrderInputProps) {
  const t = useExtracted()

  return (
    <>
      {isLimitOrder
        ? (
            <div className="mb-4">
              {side === ORDER_SIDE.SELL && (
                <EventOrderPanelUserShares
                  yesShares={availableYesTokenShares}
                  noShares={availableNoTokenShares}
                  activeOutcome={outcomeIndex}
                />
              )}
              <EventOrderPanelLimitControls
                side={side}
                limitPrice={limitPrice}
                limitShares={limitShares}
                limitExpirationEnabled={limitExpirationEnabled}
                limitExpirationOption={limitExpirationOption}
                limitExpirationTimestamp={limitExpirationTimestamp}
                isLimitOrder={isLimitOrder}
                matchingShares={limitMatchingShares}
                availableShares={availableShares}
                showLimitMinimumWarning={shouldShowLimitMinimumWarning}
                shouldShakeShares={shouldShakeLimitShares}
                limitSharesRef={limitSharesRef}
                onLimitPriceChange={onLimitPriceChange}
                onLimitSharesChange={onLimitSharesChange}
                onLimitExpirationEnabledChange={onLimitExpirationEnabledChange}
                onLimitExpirationOptionChange={onLimitExpirationOptionChange}
                onLimitExpirationTimestampChange={onLimitExpirationTimestampChange}
                onAmountUpdateFromLimit={onAmountUpdateFromLimit}
              />
            </div>
          )
        : (
            <>
              {side === ORDER_SIDE.SELL
                ? (
                    <EventOrderPanelUserShares
                      yesShares={availableYesPositionShares}
                      noShares={availableNoPositionShares}
                      activeOutcome={outcomeIndex}
                    />
                  )
                : <div className="mb-4"></div>}
              <EventOrderPanelInput
                isMobile={isMobile}
                side={side}
                amount={amount}
                amountNumber={amountNumber}
                availableShares={availableShares}
                balance={balance}
                isBalanceLoading={isBalanceLoading}
                inputRef={inputRef}
                onAmountChange={onAmountChange}
                shouldShake={shouldShakeInput}
              />
              <div
                className={cn(
                  'overflow-hidden transition-all duration-500 ease-in-out',
                  shouldShowEarnings
                    ? 'max-h-96 translate-y-0 opacity-100'
                    : 'pointer-events-none max-h-0 -translate-y-2 opacity-0',
                )}
                aria-hidden={!shouldShowEarnings}
              >
                <EventOrderPanelEarnings
                  isMobile={isMobile}
                  side={side}
                  sellAmountLabel={sellAmountLabel}
                  avgSellPriceLabel={avgSellPriceLabel}
                  avgBuyPriceLabel={avgBuyPriceLabel}
                  avgSellPriceCents={avgSellPriceCentsValue}
                  avgBuyPriceCents={avgBuyPriceCentsValue}
                  buyPayout={buyPayoutSummary.payout}
                  buyProfit={buyPayoutSummary.profit}
                  buyChangePct={buyPayoutSummary.changePct}
                  buyMultiplier={buyPayoutSummary.multiplier}
                />
              </div>
              {shouldShowResolvedMarketMinimumWarning && (
                <div
                  className={`
                    mt-3 flex animate-order-shake items-center justify-center gap-2 pb-1 text-sm font-semibold
                    text-orange-500
                  `}
                >
                  <TriangleAlertIcon className="size-4" />
                  {t('Market buys must be at least $1')}
                </div>
              )}
              {shouldShowResolvedNoLiquidityWarning && (
                <div
                  className={`
                    mt-3 flex animate-order-shake items-center justify-center gap-2 pb-1 text-sm font-semibold
                    text-orange-500
                  `}
                >
                  <TriangleAlertIcon className="size-4" />
                  {t('No liquidity for this market order')}
                </div>
              )}
            </>
          )}

      {(showInsufficientSharesWarning || showInsufficientBalanceWarning || showAmountTooLowWarning) && (
        <div
          className={`
            mt-2 mb-3 flex animate-order-shake items-center justify-center gap-2 text-sm font-semibold text-orange-500
          `}
        >
          <TriangleAlertIcon className="size-4" />
          {showAmountTooLowWarning
            ? t('Amount too low')
            : showInsufficientBalanceWarning
              ? t('Insufficient USDC balance')
              : t('Insufficient shares for this order')}
        </div>
      )}

      {(feePreview || isFeePreviewLoading) && (
        <div className="mt-2 mb-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t('Estimated fees before signing')}</p>
          {feePreview
            ? (
                <>
                  <p>
                    {t('Taker')}
                    :
                    {' '}
                    {formatCurrency(feePreview.totalTakerFee)}
                    {' '}
                    (
                    {t('Platform')}
                    {' '}
                    {formatCurrency(feePreview.platformTakerFee)}
                    {' + '}
                    {t('Builder')}
                    {' '}
                    {formatCurrency(feePreview.builderTakerFee)}
                    )
                  </p>
                  <p>
                    {t('Maker')}
                    :
                    {' '}
                    {formatCurrency(feePreview.totalMakerFee)}
                    {' '}
                    (
                    {t('Platform')}
                    {' '}
                    {formatCurrency(feePreview.platformMakerFee)}
                    {' + '}
                    {t('Builder')}
                    {' '}
                    {formatCurrency(feePreview.builderMakerFee)}
                    )
                  </p>
                </>
              )
            : (
                <p>{t('Calculating fees...')}</p>
              )}
        </div>
      )}

      <EventOrderPanelSubmitButton
        type={!isInteractiveWalletReady || shouldShowDepositCta ? 'button' : 'submit'}
        isLoading={isLoading}
        isDisabled={isLoading}
        selectedAccent={selectedSubmitAccent}
        styleVariant={outcomeButtonStyleVariant}
        onClick={onSubmitButtonClick}
        label={submitButtonLabel}
      />
    </>
  )
}
