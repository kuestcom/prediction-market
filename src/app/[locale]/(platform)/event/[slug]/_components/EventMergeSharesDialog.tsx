import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
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
import { DEFAULT_CONDITION_PARTITION, DEFAULT_ERROR_MESSAGE, MICRO_UNIT } from '@/lib/constants'
import { UMA_NEG_RISK_ADAPTER_ADDRESS, ZERO_COLLECTION_ID } from '@/lib/contracts'
import { formatAmountInputValue, toMicro } from '@/lib/formatters'
import {
  aggregateSafeTransactions,
  buildMergePositionTransaction,
  getSafeTxTypedData,
  packSafeSignature,

} from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/stores/useNotifications'
import { useUser } from '@/stores/useUser'

interface EventMergeSharesDialogProps {
  open: boolean
  availableShares: number
  conditionId?: string
  marketTitle?: string
  marketIconUrl?: string | null
  isNegRiskMarket?: boolean
  onOpenChange: (open: boolean) => void
}

export default function EventMergeSharesDialog({
  open,
  availableShares,
  conditionId,
  marketTitle,
  marketIconUrl,
  isNegRiskMarket = false,
  onOpenChange,
}: EventMergeSharesDialogProps) {
  const t = useExtracted()
  const queryClient = useQueryClient()
  const { ensureTradingReady, openTradeRequirements } = useTradingOnboarding()
  const user = useUser()
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)
  const isMobile = useIsMobile()
  const { signMessageAsync } = useSignMessage()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function formatFullPrecision(value: number) {
    if (!Number.isFinite(value)) {
      return '0'
    }
    const asString = value.toLocaleString('en-US', {
      useGrouping: false,
      maximumFractionDigits: 2,
    })
    if (!asString.includes('.')) {
      return asString
    }
    const trimmed = asString.replace(/0+$/, '').replace(/\.$/, '')
    return trimmed || '0'
  }

  useEffect(() => {
    if (!open) {
      setAmount('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const formattedAvailableShares = useMemo(() => {
    return formatFullPrecision(availableShares)
  }, [availableShares])

  const numericAvailableShares = Number.isFinite(availableShares) ? availableShares : 0

  function handleAmountChange(value: string) {
    const sanitized = value.replace(/,/g, '.')
    if (sanitized === '' || /^\d*(?:\.\d{0,2})?$/.test(sanitized)) {
      setAmount(sanitized)
      setError(null)
    }
  }

  function isWholeCentAmount(value: number) {
    const scaled = value * 100
    return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-8
  }

  function handleMaxClick() {
    if (numericAvailableShares <= 0) {
      return
    }

    // Use the raw value to avoid rounding up tiny remainders that would fail validation
    const floored = formatAmountInputValue(numericAvailableShares, { roundingMode: 'floor' })
    setAmount(floored || '0')
    setError(null)
  }

  async function handleSubmit() {
    if (!conditionId) {
      toast.error(t('Select a market before merging shares.'))
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    const numericAmount = Number.parseFloat(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('Enter a valid amount.'))
      return
    }

    if (!isWholeCentAmount(numericAmount)) {
      setError(t('Amount must be in whole cents.'))
      return
    }

    const amountMicro = Math.floor(numericAmount * MICRO_UNIT + 1e-9)
    const availableMicro = Math.floor(numericAvailableShares * MICRO_UNIT + 1e-9)
    if (amountMicro > availableMicro) {
      setError(t('Amount exceeds available shares.'))
      return
    }

    if (!user?.proxy_wallet_address) {
      toast.error(t('Deploy your proxy wallet before merging shares.'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        if (isTradingAuthRequiredError(nonceResult.error)) {
          onOpenChange(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        setIsSubmitting(false)
        return
      }

      const transactions = [
        buildMergePositionTransaction({
          conditionId: conditionId as `0x${string}`,
          partition: [...DEFAULT_CONDITION_PARTITION],
          amount: toMicro(numericAmount),
          parentCollectionId: ZERO_COLLECTION_ID,
          contract: isNegRiskMarket ? UMA_NEG_RISK_ADAPTER_ADDRESS : undefined,
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

      const payload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'merge_position',
      }

      const response = await submitSafeTransactionAction(payload)

      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          onOpenChange(false)
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(response.error)
        }
        setIsSubmitting(false)
        return
      }

      if (user?.settings?.notifications?.inapp_order_fills && response?.txHash) {
        addLocalOrderFillNotification({
          action: 'merge',
          txHash: response.txHash,
          title: t('Merge shares'),
          description: marketTitle ?? t('Request submitted.'),
          marketIconUrl,
        })
      }

      toast.success(t('Merge shares'), {
        description: marketTitle ?? t('Request submitted.'),
        icon: <SuccessIcon />,
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
      setAmount('')
      onOpenChange(false)
    }
    catch (error) {
      console.error('Failed to submit merge operation.', error)
      toast.error(t('We could not submit your merge request. Please try again.'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const dialogTitle = t('Merge shares')
  const dialogDescription = t(
    'Merge a share of {yes} and {no} to get 1 USDC. You can do this to save cost when trying to get rid of a position.',
    {
      yes: t('Yes'),
      no: t('No'),
    },
  )
  const formBody = (
    <>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground" htmlFor="merge-shares-amount">
          {t('Amount')}
        </label>
        <Input
          id="merge-shares-amount"
          value={amount}
          onChange={event => handleAmountChange(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          className="h-12 text-base"
        />
        <div className="text-xs text-foreground/80">
          <span className="flex items-center gap-1">
            {t('Available shares:')}
            <strong className="text-foreground">{formattedAvailableShares}</strong>
            <button
              type="button"
              className={cn(
                'text-primary transition-colors',
                numericAvailableShares > 0 ? 'hover:opacity-80' : 'cursor-not-allowed opacity-40',
              )}
              onClick={handleMaxClick}
              disabled={numericAvailableShares <= 0}
            >
              {t('Max')}
            </button>
          </span>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <Button
        type="button"
        size="outcome"
        className="w-full text-base font-bold"
        disabled={isSubmitting || !conditionId}
        onClick={handleSubmit}
      >
        {isSubmitting ? t('Merging...') : t('Merge Shares')}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          <div className="space-y-6">
            <DrawerHeader className="space-y-3 text-center">
              <DrawerTitle className="text-2xl font-bold">{dialogTitle}</DrawerTitle>
              <DrawerDescription className="text-sm text-foreground">{dialogDescription}</DrawerDescription>
            </DrawerHeader>
            {formBody}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:p-8">
        <div className="space-y-6">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-center text-2xl font-bold">{dialogTitle}</DialogTitle>
            <DialogDescription className="text-center text-sm text-foreground">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          {formBody}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SuccessIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-yes/20 text-yes">
      <CheckIcon className="size-4" />
    </span>
  )
}
