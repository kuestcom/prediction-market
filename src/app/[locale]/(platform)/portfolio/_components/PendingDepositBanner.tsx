'use client'

import type { SafeOperationType } from '@/lib/safe/transactions'
import { ArrowDownToLineIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { buildPendingUsdcSwapAction, submitPendingUsdcSwapAction } from '@/app/[locale]/(platform)/portfolio/_actions/pending-deposit'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { usePendingUsdcDeposit } from '@/hooks/usePendingUsdcDeposit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useRouter } from '@/i18n/navigation'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { DEFAULT_CHAIN_ID, IS_TEST_MODE } from '@/lib/network'
import { getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { triggerConfettiColorful } from '@/lib/utils'
import { isUserRejectedRequestError } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const CONFIRMATION_DELAY_MS = 900

type PendingDepositStep = 'prompt' | 'signing' | 'success'

function usePendingDepositDialogState() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<PendingDepositStep>('prompt')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const resetDialogState = useCallback(() => {
    setStep('prompt')
    setStatusMessage(null)
  }, [])

  const openDialog = useCallback(() => {
    resetDialogState()
    setOpen(true)
  }, [resetDialogState])

  const closeDialog = useCallback(() => {
    setOpen(false)
    resetDialogState()
  }, [resetDialogState])

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      openDialog()
      return
    }

    closeDialog()
  }, [openDialog, closeDialog])

  return {
    open,
    step,
    setStep,
    statusMessage,
    setStatusMessage,
    openDialog,
    closeDialog,
    handleOpenChange,
  }
}

function usePendingDepositSwap({
  step,
  setStep,
  setStatusMessage,
  closeDialog,
  userAddress,
  userProxyWalletAddress,
  pendingBalanceRawBase,
  refetchPendingDeposit,
  openTradeRequirements,
  runWithSignaturePrompt,
  signMessageAsync,
  t,
}: {
  step: PendingDepositStep
  setStep: (step: PendingDepositStep) => void
  setStatusMessage: (message: string | null) => void
  closeDialog: () => void
  userAddress: string | null
  userProxyWalletAddress: string | null
  pendingBalanceRawBase: string | null
  refetchPendingDeposit: () => void
  openTradeRequirements: ReturnType<typeof useTradingOnboarding>['openTradeRequirements']
  runWithSignaturePrompt: ReturnType<typeof useSignaturePromptRunner>['runWithSignaturePrompt']
  signMessageAsync: ReturnType<typeof useSignMessage>['signMessageAsync']
  t: ReturnType<typeof useExtracted>
}) {
  const handleConfirm = useCallback(async () => {
    if (step === 'signing') {
      return
    }

    if (IS_TEST_MODE) {
      setStatusMessage(t('Swap is disabled on test Mode.'))
      return
    }

    if (!userAddress || !userProxyWalletAddress) {
      toast.error(t('Connect your wallet to continue.'))
      return
    }

    if (!pendingBalanceRawBase || pendingBalanceRawBase === '0') {
      toast.error(t('No pending deposit found.'))
      return
    }

    setStatusMessage(null)
    setStep('signing')

    try {
      const buildResult = await buildPendingUsdcSwapAction({
        amount: pendingBalanceRawBase,
      })

      if (buildResult.error || !buildResult.payload) {
        if (isTradingAuthRequiredError(buildResult.error)) {
          closeDialog()
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(buildResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        setStep('prompt')
        return
      }

      const { transaction, nonce, signatureParams } = buildResult.payload
      const typedData = getSafeTxTypedData({
        chainId: DEFAULT_CHAIN_ID,
        safeAddress: userProxyWalletAddress as `0x${string}`,
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

      const signature = await runWithSignaturePrompt(() => signMessageAsync({ message: { raw: structHash } }))
      const submitPayload = {
        type: 'SAFE' as const,
        from: userAddress,
        to: transaction.to,
        proxyWallet: userProxyWalletAddress,
        data: transaction.data,
        nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams: signatureParams ?? typedSignatureParams,
        metadata: 'swap_usdc_e',
      }

      const submitResult = await submitPendingUsdcSwapAction(submitPayload)
      if (submitResult.error) {
        if (isTradingAuthRequiredError(submitResult.error)) {
          closeDialog()
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(submitResult.error)
        }
        setStep('prompt')
        return
      }

      await new Promise(resolve => setTimeout(resolve, CONFIRMATION_DELAY_MS))
      setStep('success')
      triggerConfettiColorful()
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
    closeDialog,
    openTradeRequirements,
    pendingBalanceRawBase,
    refetchPendingDeposit,
    runWithSignaturePrompt,
    setStatusMessage,
    setStep,
    signMessageAsync,
    t,
    step,
    userAddress,
    userProxyWalletAddress,
  ])

  return { handleConfirm }
}

export default function PendingDepositBanner() {
  const t = useExtracted()
  const { pendingBalance, hasPendingDeposit, refetchPendingDeposit } = usePendingUsdcDeposit()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const router = useRouter()
  const user = useUser()
  const userAddress = user?.address ?? null
  const userProxyWalletAddress = user?.proxy_wallet_address ?? null
  const { openTradeRequirements } = useTradingOnboarding()
  const {
    open,
    step,
    setStep,
    statusMessage,
    setStatusMessage,
    openDialog,
    closeDialog,
    handleOpenChange,
  } = usePendingDepositDialogState()
  const { handleConfirm } = usePendingDepositSwap({
    step,
    setStep,
    setStatusMessage,
    closeDialog,
    userAddress,
    userProxyWalletAddress,
    pendingBalanceRawBase: pendingBalance.rawBase,
    refetchPendingDeposit,
    openTradeRequirements,
    runWithSignaturePrompt,
    signMessageAsync,
    t,
  })

  const formattedAmount = formatCurrency(pendingBalance.raw, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (!hasPendingDeposit) {
    return null
  }

  return (
    <>
      <Button
        className="h-11 w-full justify-between px-4 text-left"
        onClick={openDialog}
      >
        <span className="text-sm font-semibold">{t('Confirm pending deposit')}</span>
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
            <p className="mt-6 text-base font-semibold text-foreground">{t('Waiting for signature...')}</p>
          )}

          {step === 'prompt' && (
            <p className="mt-6 text-base font-semibold text-foreground">
              {t('Activate your funds ({amount}) to begin trading.', { amount: formattedAmount })}
            </p>
          )}

          {step === 'success' && (
            <p className="mt-6 text-base font-semibold text-foreground">{t('Your funds are available to trade!')}</p>
          )}

          {step === 'prompt' && (
            <Button className="mt-6 h-11 w-full text-base" onClick={handleConfirm}>
              {t('Continue')}
            </Button>
          )}

          {step === 'prompt' && statusMessage && (
            <div className="mt-3 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          )}

          {step === 'signing' && (
            <div className="mt-6 text-sm text-muted-foreground">
              {t('Confirm the signature in your wallet.')}
            </div>
          )}

          {step === 'success' && (
            <Button
              className="mt-6 h-11 w-full text-base"
              onClick={() => {
                closeDialog()
                router.push('/')
              }}
            >
              {t('Start Trading')}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
