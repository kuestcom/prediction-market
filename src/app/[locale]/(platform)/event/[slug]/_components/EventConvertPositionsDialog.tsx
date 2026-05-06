'use client'

import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { UserPosition } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheckIcon, Loader2Icon, LockKeyholeIcon, MoveDownIcon, MoveLeftIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSignTypedData } from 'wagmi'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { MICRO_UNIT } from '@/lib/constants'
import { formatAmountInputValue, formatCurrency, formatSharesLabel } from '@/lib/formatters'
import { applyPositionDeltasToUserPositions, applyShareDeltas, updateQueryDataWhere } from '@/lib/optimistic-trading'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildConvertPositionsCall } from '@/lib/wallet/transactions'
import { useUser } from '@/stores/useUser'

interface ConvertPositionOption {
  id: string
  label: string
  shares: number
  conditionId: string
}

interface ConvertOutcomeOption {
  conditionId: string
  questionId?: string
  label: string
}

interface EventConvertPositionsDialogProps {
  open: boolean
  options: ConvertPositionOption[]
  outcomes: ConvertOutcomeOption[]
  eventId?: string
  eventSlug?: string
  negRiskMarketId?: string
  isNegRiskAugmented?: boolean
  onOpenChange: (open: boolean) => void
}

function parseQuestionIndex(questionId?: string) {
  if (!questionId) {
    return null
  }
  const normalized = questionId.startsWith('0x') ? questionId.slice(2) : questionId
  if (normalized.length < 2) {
    return null
  }
  const lastByte = normalized.slice(-2)
  const index = Number.parseInt(lastByte, 16)
  return Number.isFinite(index) ? index : null
}

function useConvertPositionsSelection({
  options,
  outcomes,
}: {
  options: ConvertPositionOption[]
  outcomes: ConvertOutcomeOption[]
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(options.map(option => option.id)))

  function toggleOption(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }

  const selectedMax = useMemo(() => {
    let minValue: number | null = null
    options.forEach((option) => {
      if (!selectedIds.has(option.id)) {
        return
      }
      if (minValue === null || option.shares < minValue) {
        minValue = option.shares
      }
    })
    return minValue ?? 0
  }, [options, selectedIds])

  const selectedOptions = useMemo(
    () => options.filter(option => selectedIds.has(option.id)),
    [options, selectedIds],
  )

  const selectedConditionIds = useMemo(
    () => new Set(selectedOptions.map(option => option.conditionId)),
    [selectedOptions],
  )

  const conversionOutcomes = useMemo(
    () => outcomes.filter(outcome => !selectedConditionIds.has(outcome.conditionId)),
    [outcomes, selectedConditionIds],
  )

  const questionIndexByCondition = useMemo(() => {
    const map = new Map<string, number>()
    outcomes.forEach((outcome) => {
      const questionIndex = parseQuestionIndex(outcome.questionId)
      if (questionIndex !== null) {
        map.set(outcome.conditionId, questionIndex)
      }
    })
    return map
  }, [outcomes])

  const selectedIndexSet = useMemo(() => {
    let indexSet = 0n
    selectedConditionIds.forEach((conditionId) => {
      const questionIndex = questionIndexByCondition.get(conditionId)
      if (questionIndex !== undefined) {
        indexSet |= 1n << BigInt(questionIndex)
      }
    })
    return indexSet
  }, [selectedConditionIds, questionIndexByCondition])

  const hasMissingQuestionIndex = useMemo(() => {
    if (selectedConditionIds.size === 0) {
      return false
    }
    for (const conditionId of selectedConditionIds) {
      if (!questionIndexByCondition.has(conditionId)) {
        return true
      }
    }
    return false
  }, [selectedConditionIds, questionIndexByCondition])

  return {
    selectedIds,
    toggleOption,
    selectedMax,
    selectedOptions,
    conversionOutcomes,
    selectedIndexSet,
    hasMissingQuestionIndex,
  }
}

export default function EventConvertPositionsDialog({
  open,
  options,
  outcomes,
  eventId,
  eventSlug,
  negRiskMarketId,
  isNegRiskAugmented = false,
  onOpenChange,
}: EventConvertPositionsDialogProps) {
  if (!open) {
    return null
  }

  return (
    <EventConvertPositionsDialogContent
      options={options}
      outcomes={outcomes}
      eventId={eventId}
      eventSlug={eventSlug}
      negRiskMarketId={negRiskMarketId}
      isNegRiskAugmented={isNegRiskAugmented}
      onOpenChange={onOpenChange}
    />
  )
}

interface EventConvertPositionsDialogContentProps extends Omit<EventConvertPositionsDialogProps, 'open'> {}

function EventConvertPositionsDialogContent({
  options,
  outcomes,
  eventId,
  eventSlug,
  negRiskMarketId,
  isNegRiskAugmented = false,
  onOpenChange,
}: EventConvertPositionsDialogContentProps) {
  const t = useExtracted()
  const queryClient = useQueryClient()
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const user = useUser()
  const isMobile = useIsMobile()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const checkboxBaseId = useId()
  const [amount, setAmount] = useState('0')
  const [step, setStep] = useState<'select' | 'review'>('select')
  const [submitState, setSubmitState] = useState<'idle' | 'signing' | 'submitting'>('idle')

  const {
    selectedIds,
    toggleOption,
    selectedMax,
    selectedOptions,
    conversionOutcomes,
    selectedIndexSet,
    hasMissingQuestionIndex,
  } = useConvertPositionsSelection({ options, outcomes })
  const hasSelection = selectedOptions.length > 0
  const numericAmount = Number(amount)
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0
  const isReviewDisabled = !hasSelection || !hasValidAmount || hasMissingQuestionIndex

  function truncateToDecimals(value: number, decimals: number) {
    if (!Number.isFinite(value)) {
      return 0
    }
    const factor = 10 ** decimals
    return Math.floor(value * factor + 1e-8) / factor
  }

  const normalizedAmount = hasValidAmount ? truncateToDecimals(numericAmount, 2) : 0
  const totalLabel = formatSharesLabel(selectedMax, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
  const amountLabel = formatSharesLabel(normalizedAmount, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
  const usdcAmount = hasValidAmount && selectedOptions.length > 1
    ? (selectedOptions.length - 1) * normalizedAmount
    : 0
  const usdcLabel = formatCurrency(truncateToDecimals(usdcAmount, 2), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const isSubmitting = submitState !== 'idle'
  const canSubmit = !isReviewDisabled
    && Boolean(negRiskMarketId)
    && selectedIndexSet > 0n
    && !isSubmitting

  function handleAmountChange(value: string) {
    const sanitized = value.replace(/,/g, '.')
    if (sanitized === '') {
      setAmount(sanitized)
      return
    }
    if (!/^\d*(?:\.\d*)?$/.test(sanitized)) {
      return
    }
    const hasDot = sanitized.includes('.')
    let [integerPart, fractionPart = ''] = sanitized.split('.')
    if (integerPart === '' && hasDot) {
      integerPart = '0'
    }
    const trimmedFraction = fractionPart.slice(0, 2)
    const hasTrailingDot = hasDot && sanitized.endsWith('.') && fractionPart.length === 0
    const nextValue = hasTrailingDot
      ? `${integerPart}.`
      : trimmedFraction.length > 0
        ? `${integerPart}.${trimmedFraction}`
        : integerPart
    if (nextValue !== amount) {
      setAmount(nextValue)
    }
  }

  function handleMaxClick() {
    if (!(selectedMax > 0)) {
      return
    }
    const formatted = formatAmountInputValue(selectedMax, { roundingMode: 'floor' })
    setAmount(formatted || '0')
  }

  async function handleSubmit() {
    if (!ensureTradingReady()) {
      return
    }

    if (!negRiskMarketId) {
      toast.error(t('Convert unavailable right now.'))
      return
    }

    if (!user?.deposit_wallet_address) {
      toast.error(t('Set up your Deposit Wallet before converting.'))
      return
    }

    if (!(selectedIndexSet > 0n)) {
      toast.error(t('Select one or more positions.'))
      return
    }

    if (!hasValidAmount || normalizedAmount <= 0) {
      toast.error(t('Enter a valid amount.'))
      return
    }

    if (normalizedAmount > selectedMax) {
      toast.error(t('Amount exceeds available shares.'))
      return
    }

    const amountMicro = Math.floor(normalizedAmount * MICRO_UNIT + 1e-9)
    if (amountMicro <= 0) {
      toast.error(t('Enter a valid amount.'))
      return
    }

    setSubmitState('signing')

    try {
      const calls = [
        buildConvertPositionsCall({
          marketId: negRiskMarketId as `0x${string}`,
          indexSet: selectedIndexSet,
          amount: amountMicro.toString(),
        }),
      ]

      setSubmitState('submitting')

      const response = await runWithSignaturePrompt(() => signAndSubmitDepositWalletCalls({
        user,
        calls,
        metadata: 'convert_positions',
        signTypedDataAsync,
      }))
      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          onOpenChange(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(response.error)
        }
        setSubmitState('idle')
        return
      }

      toast.success(t('Convert Completed'), {
        description: t('You have new shares'),
        icon: <ConvertSuccessIcon />,
      })

      const optimisticDeltas = [
        ...selectedOptions.map(option => ({
          conditionId: option.conditionId,
          outcomeIndex: 1 as const,
          sharesDelta: -normalizedAmount,
          currentPrice: 0.5,
          title: option.label,
          slug: option.conditionId,
          eventSlug,
          outcomeText: 'No',
          isActive: true,
          isResolved: false,
        })),
        ...conversionOutcomes.map(outcome => ({
          conditionId: outcome.conditionId,
          outcomeIndex: 0 as const,
          sharesDelta: normalizedAmount,
          avgPrice: 0.5,
          currentPrice: 0.5,
          title: outcome.label,
          slug: outcome.conditionId,
          eventSlug,
          outcomeText: 'Yes',
          isActive: true,
          isResolved: false,
        })),
      ]
      const affectedConditionIds = new Set(optimisticDeltas.map(delta => delta.conditionId))

      updateQueryDataWhere<UserPosition[]>(
        queryClient,
        ['order-panel-user-positions'],
        currentQueryKey => affectedConditionIds.has(String(currentQueryKey[2] ?? '')),
        current => applyPositionDeltasToUserPositions(current, optimisticDeltas),
      )
      updateQueryDataWhere<UserPosition[]>(
        queryClient,
        ['user-market-positions'],
        currentQueryKey =>
          affectedConditionIds.has(String(currentQueryKey[2] ?? ''))
          && currentQueryKey[3] === 'active',
        current => applyPositionDeltasToUserPositions(current, optimisticDeltas),
      )
      updateQueryDataWhere<UserPosition[]>(
        queryClient,
        ['event-user-positions'],
        currentQueryKey => currentQueryKey[2] === eventId,
        current => applyPositionDeltasToUserPositions(current, optimisticDeltas),
      )
      updateQueryDataWhere<UserPosition[]>(
        queryClient,
        ['user-event-positions'],
        currentQueryKey =>
          currentQueryKey[2] === 'active'
          && Array.from(affectedConditionIds).some(conditionId =>
            String(currentQueryKey[3] ?? '').includes(conditionId),
          ),
        current => applyPositionDeltasToUserPositions(current, optimisticDeltas),
      )
      updateQueryDataWhere<SharesByCondition>(
        queryClient,
        ['user-conditional-shares'],
        () => true,
        current => applyShareDeltas(
          current,
          optimisticDeltas.map(delta => ({
            conditionId: delta.conditionId,
            outcomeIndex: delta.outcomeIndex,
            sharesDelta: delta.sharesDelta,
          })),
        ),
      )

      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })

      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to submit convert operation.', error)
      toast.error(t('We could not submit your convert request. Please try again.'))
    }
    finally {
      setSubmitState('idle')
    }
  }

  const selectContent = (
    <div className="space-y-5 text-foreground">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Select one or more</p>
        <div className="max-h-36 overflow-y-auto rounded-lg border bg-background">
          {options.map((option, index) => {
            const checkboxId = `${checkboxBaseId}-${index}`
            const sharesLabel = formatSharesLabel(option.shares, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            })

            return (
              <label
                key={option.id}
                htmlFor={checkboxId}
                className={cn(
                  `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors`,
                  { 'border-b': index < options.length - 1 },
                  selectedIds.has(option.id) ? 'opacity-100' : 'opacity-80',
                )}
              >
                <Checkbox
                  id={checkboxId}
                  checked={selectedIds.has(option.id)}
                  onCheckedChange={() => toggleOption(option.id)}
                  className="size-5 rounded-sm"
                />
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  <span className={`
                    inline-flex size-5 items-center justify-center rounded-sm bg-no/20 text-2xs font-semibold text-no
                  `}
                  >
                    {t('No')}
                  </span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {sharesLabel}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Amount</span>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span>{totalLabel}</span>
            <button
              type="button"
              className={cn(
                'transition-colors',
                selectedMax > 0 ? 'text-muted-foreground hover:text-foreground' : 'cursor-not-allowed opacity-40',
              )}
              onClick={handleMaxClick}
              disabled={selectedMax <= 0}
            >
              Max
            </button>
          </div>
        </div>
        <Input
          value={amount}
          onChange={event => handleAmountChange(event.target.value)}
          placeholder="0"
          inputMode="decimal"
          className="h-12 text-base"
          aria-invalid={!hasSelection}
        />
      </div>

      <Button
        type="button"
        className="h-12 w-full text-base font-semibold"
        disabled={isReviewDisabled}
        onClick={() => setStep('review')}
      >
        Review
      </Button>
    </div>
  )

  const reviewContent = (
    <div className="space-y-5 text-foreground">
      <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70 bg-muted/60 p-3">
        <div className="space-y-0">
          <div className="rounded-lg border bg-background p-3">
            <div className="flex flex-col gap-4">
              {selectedOptions.map(option => (
                <div
                  key={option.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{option.label}</span>
                    <span className={`
                      inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-no/20 px-1 text-2xs
                      font-semibold text-no
                    `}
                    >
                      {t('No')}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    -
                    {amountLabel}
                    {' '}
                    shares
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 -my-2 flex items-center justify-center text-muted-foreground">
            <div className="rounded-md border-8 border-muted/60 bg-background p-1">
              <MoveDownIcon className="size-4" />
            </div>
          </div>

          <div className="rounded-lg border bg-background p-3">
            <div className="flex flex-col gap-4">
              {conversionOutcomes.map(outcome => (
                <div
                  key={outcome.conditionId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{outcome.label}</span>
                    <span className={`
                      inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-yes/20 px-1 text-2xs
                      font-semibold text-yes
                    `}
                    >
                      {t('Yes')}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    +
                    {amountLabel}
                    {' '}
                    shares
                  </span>
                </div>
              ))}
              {isNegRiskAugmented && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Other</span>
                    <span className={`
                      inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm bg-yes/20 px-1 text-2xs
                      font-semibold text-yes
                    `}
                    >
                      <LockKeyholeIcon className="size-3" />
                      {t('Yes')}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    +
                    {amountLabel}
                    {' '}
                    shares
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-semibold">
              <span className="text-primary">USDC 💸</span>
              <span className="text-muted-foreground">
                +
                {usdcLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="button"
        className="h-12 w-full text-base font-semibold"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitState === 'signing' && <Loader2Icon className="size-4 animate-spin" />}
        {submitState === 'submitting' && <Loader2Icon className="size-4 animate-spin" />}
        {submitState === 'signing'
          ? 'Awaiting signature'
          : submitState === 'submitting'
            ? 'Submitting...'
            : 'Confirm'}
      </Button>
    </div>
  )

  const content = step === 'review' ? reviewContent : selectContent

  const title = 'Convert positions'
  const description = `Convert your "${t('No')}" positions to the complementary "${t('Yes')}" positions (and potentially USDC).`
  const reviewHeader = (
    <button
      type="button"
      className={`
        inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-colors
        hover:text-foreground/80
      `}
      onClick={() => setStep('select')}
    >
      <MoveLeftIcon className="size-4" />
      Review
    </button>
  )

  if (isMobile) {
    return (
      <Drawer open onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          <div className="space-y-6">
            {step === 'review'
              ? (
                  <div className="flex items-center">
                    {reviewHeader}
                  </div>
                )
              : (
                  <DrawerHeader className="space-y-3 text-center">
                    <DrawerTitle className="text-2xl font-bold">{title}</DrawerTitle>
                    <DrawerDescription className="text-sm text-foreground">
                      {description}
                    </DrawerDescription>
                  </DrawerHeader>
                )}
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md sm:p-6">
        <div className="space-y-6">
          {step === 'review'
            ? (
                <div className="flex items-center">
                  {reviewHeader}
                </div>
              )
            : (
                <DialogHeader className="space-y-3">
                  <DialogTitle className="text-center text-2xl font-bold">{title}</DialogTitle>
                  <DialogDescription className="text-center text-sm text-foreground">
                    {description}
                  </DialogDescription>
                </DialogHeader>
              )}
          {content}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConvertSuccessIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-yes/20 text-yes">
      <BadgeCheckIcon className="size-4" />
    </span>
  )
}
