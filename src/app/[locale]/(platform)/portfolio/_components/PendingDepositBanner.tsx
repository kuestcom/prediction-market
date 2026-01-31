'use client'

import type { SafeOperationType } from '@/lib/safe/transactions'
import { ArrowDownToLineIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { buildPendingUsdcSwapAction, submitPendingUsdcSwapAction } from '@/app/[locale]/(platform)/portfolio/_actions/pending-deposit'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { usePendingUsdcDeposit } from '@/hooks/usePendingUsdcDeposit'
import { useRouter } from '@/i18n/navigation'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { IS_TEST_MODE } from '@/lib/network'
import { getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { triggerConfettiColorful } from '@/lib/utils'
import { isUserRejectedRequestError } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const CONFIRMATION_DELAY_MS = 900

type PendingDepositStep = 'prompt' | 'signing' | 'success'

export default function PendingDepositBanner() {
  const { pendingBalance, hasPendingDeposit, refetchPendingDeposit } = usePendingUsdcDeposit()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const user = useUser()
  const { openTradeRequirements } = useTradingOnboarding()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<PendingDepositStep>('prompt')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const formattedAmount = useMemo(() => formatCurrency(pendingBalance.raw, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }), [pendingBalance.raw])

  useEffect(() => {
    if (!open) {
      setStep('prompt')
      setStatusMessage(null)
    }
  }, [open])

  useEffect(() => {
    if (step !== 'success') {
      return
    }

    triggerConfettiColorful()
  }, [step])

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (step === 'signing') {
      return
    }

    if (IS_TEST_MODE) {
      setStatusMessage('Swap is disabled on test Mode.')
      return
    }

    if (!user?.address || !user.proxy_wallet_address) {
      toast.error('Connect your wallet to continue.')
      return
    }

    if (!pendingBalance.rawBase || pendingBalance.rawBase === '0') {
      toast.error('No pending deposit found.')
      return
    }

    setStatusMessage(null)
    setStep('signing')

    try {
      const buildResult = await buildPendingUsdcSwapAction({
        amount: pendingBalance.rawBase,
      })

      if (buildResult.error || !buildResult.payload) {
        if (isTradingAuthRequiredError(buildResult.error)) {
          setOpen(false)
          openTradeRequirements()
        }
        else {
          toast.error(buildResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        setStep('prompt')
        return
      }

      const { transaction, nonce, signatureParams } = buildResult.payload
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: {
          to: transaction.to as `0x${string}`,
          value: transaction.value,
          data: transaction.data as `0x${string}`,
          operation: transaction.operation as SafeOperationType,
        },
        nonce,
      })

      const { signatureParams: typedSignatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await signMessageAsync({ message: { raw: structHash } })
      const submitPayload = {
        type: 'SAFE' as const,
        from: user.address,
        to: transaction.to,
        proxyWallet: user.proxy_wallet_address,
        data: transaction.data,
        nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams: signatureParams ?? typedSignatureParams,
        metadata: 'swap_usdc_e',
      }

      const submitResult = await submitPendingUsdcSwapAction(submitPayload)
      if (submitResult.error) {
        if (isTradingAuthRequiredError(submitResult.error)) {
          setOpen(false)
          openTradeRequirements()
        }
        else {
          toast.error(submitResult.error)
        }
        setStep('prompt')
        return
      }

      await new Promise(resolve => setTimeout(resolve, CONFIRMATION_DELAY_MS))
      setStep('success')
      void refetchPendingDeposit()
    }
    catch (error) {
      if (!isUserRejectedRequestError(error)) {
        const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
        toast.error(message)
      }
      setStep('prompt')
    }
  }, [
    openTradeRequirements,
    pendingBalance.rawBase,
    refetchPendingDeposit,
    signMessageAsync,
    step,
    user?.address,
    user?.proxy_wallet_address,
  ])

  const handleStartTrading = useCallback(() => {
    setOpen(false)
    router.push('/')
  }, [router])

  if (!hasPendingDeposit) {
    return null
  }

  return (
    <>
      <Button
        className="h-11 w-full justify-between px-4 text-left"
        onClick={() => setOpen(true)}
      >
        <span className="text-sm font-semibold">Confirm pending deposit</span>
        <ArrowDownToLineIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md border bg-background p-8 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-yes">
            {step === 'signing'
              ? <Loader2Icon className="size-9 animate-spin text-background" />
              : <CheckIcon className="size-10 text-background" />}
          </div>

          {step === 'signing' && (
            <p className="mt-6 text-base font-semibold text-foreground">Waiting for signature...</p>
          )}

          {step === 'prompt' && (
            <p className="mt-6 text-base font-semibold text-foreground">
              Activate your funds (
              {formattedAmount}
              ) to begin trading.
            </p>
          )}

          {step === 'success' && (
            <p className="mt-6 text-base font-semibold text-foreground">Your funds are available to trade!</p>
          )}

          {step === 'prompt' && (
            <Button className="mt-6 h-11 w-full text-base" onClick={handleConfirm}>
              Continue
            </Button>
          )}

          {step === 'prompt' && statusMessage && (
            <div className="mt-3 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          )}

          {step === 'signing' && (
            <div className="mt-6 text-sm text-muted-foreground">
              Confirm the signature in your wallet.
            </div>
          )}

          {step === 'success' && (
            <Button className="mt-6 h-11 w-full text-base" onClick={handleStartTrading}>
              Start Trading
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
