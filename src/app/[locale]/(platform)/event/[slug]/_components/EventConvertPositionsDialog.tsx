'use client'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheckIcon, Loader2Icon, LockKeyholeIcon, MoveDownIcon, MoveLeftIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
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
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE, MICRO_UNIT } from '@/lib/constants'
import { formatAmountInputValue, formatCurrency, formatSharesLabel } from '@/lib/formatters'
import {
  aggregateSafeTransactions,
  buildConvertPositionsTransaction,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import { cn } from '@/lib/utils'
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
  negRiskMarketId?: string
  isNegRiskAugmented?: boolean
  onOpenChange: (open: boolean) => void
}

export default function EventConvertPositionsDialog({
  open,
  options,
  outcomes,
  negRiskMarketId,
  isNegRiskAugmented = false,
  onOpenChange,
}: EventConvertPositionsDialogProps) {
  const t = useExtracted()
  const queryClient = useQueryClient()
  const { ensureTradingReady } = useTradingOnboarding()
  const user = useUser()
  const isMobile = useIsMobile()
  const { signMessageAsync } = useSignMessage()
  const checkboxBaseId = useId()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [amount, setAmount] = useState('0')
  const [step, setStep] = useState<'select' | 'review'>('select')
  const [submitState, setSubmitState] = useState<'idle' | 'signing' | 'submitting'>('idle')
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setAmount('0')
      setStep('select')
      setSubmitState('idle')
      wasOpenRef.current = false
      return
    }

    if (!wasOpenRef.current) {
      setSelectedIds(new Set(options.map(option => option.id)))
      setAmount('0')
      setStep('select')
      setSubmitState('idle')
      wasOpenRef.current = true
    }
  }, [open, options])

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
  const hasSelection = selectedIds.size > 0
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
      toast.error('Convert unavailable right now.')
      return
    }

    if (!user?.proxy_wallet_address) {
      toast.error('Deploy your proxy wallet before converting.')
      return
    }

    if (!(selectedIndexSet > 0n)) {
      toast.error('Select one or more positions.')
      return
    }

    if (!hasValidAmount || normalizedAmount <= 0) {
      toast.error('Enter a valid amount.')
      return
    }

    if (normalizedAmount > selectedMax) {
      toast.error('Amount exceeds available shares.')
      return
    }

    const amountMicro = Math.floor(normalizedAmount * MICRO_UNIT + 1e-9)
    if (amountMicro <= 0) {
      toast.error('Enter a valid amount.')
      return
    }

    setSubmitState('signing')

    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        setSubmitState('idle')
        return
      }

      const transactions = [
        buildConvertPositionsTransaction({
          marketId: negRiskMarketId as `0x${string}`,
          indexSet: selectedIndexSet,
          amount: amountMicro.toString(),
        }),
      ]

      const aggregated = aggregateSafeTransactions(transactions)
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: aggregated,
        nonce: nonceResult.nonce,
      })

      const { signatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await signMessageAsync({
        message: { raw: structHash },
      })

      setSubmitState('submitting')

      const payload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'convert_positions',
      }

      const response = await submitSafeTransactionAction(payload)
      if (response?.error) {
        toast.error(response.error)
        setSubmitState('idle')
        return
      }

      toast.success('Convert Completed', {
        description: 'You have new shares',
        icon: <ConvertSuccessIcon />,
      })

      void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      }, 3000)
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      }, 3000)
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
        void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      }, 12_000)

      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to submit convert operation.', error)
      toast.error('We could not submit your convert request. Please try again.')
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
      <Drawer open={open} onOpenChange={onOpenChange}>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
