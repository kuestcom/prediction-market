'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { CircleCheckIcon, CircleXIcon, GiftIcon, HourglassIcon, LockOpenIcon, RotateCcwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { useSignTypedData } from 'wagmi'

import type { DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'

import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useAppKit } from '@/hooks/useAppKit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildResolutionRewardReleaseCall, buildResolutionRewardWithdrawalCall } from '@/lib/wallet/transactions'
import { useUser } from '@/stores/useUser'

type WithdrawalAction = 'request' | 'release'

interface SettingsResolutionWithdrawalDialogProps {
  action: WithdrawalAction
  marketTitle: string
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
  open: boolean
  proposal: DataApiRewardProposal | null
}

function fromBaseUnits(value: string) {
  try {
    return Number(BigInt(value)) / 1_000_000
  } catch {
    return 0
  }
}

export default function SettingsResolutionWithdrawalDialog({
  action,
  marketTitle,
  onOpenChange,
  onSubmitted,
  open,
  proposal,
}: SettingsResolutionWithdrawalDialogProps) {
  const t = useExtracted()
  const user = useUser()
  const { isConnected } = useAppKitAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { open: openAppKit } = useAppKit()
  const { openTradeRequirements } = useTradingOnboarding()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRelease = action === 'release'
  const formattedBond = formatCurrency(fromBaseUnits(proposal?.bondAmount ?? '0'), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const side = proposal?.side === 2 ? 'YES' : 'NO'

  async function submitWithdrawalAction() {
    if (!proposal || !user?.address || !user.deposit_wallet_address || user.deposit_wallet_status !== 'deployed') {
      openTradeRequirements()
      return false
    }

    const response = await signAndSubmitDepositWalletCalls({
      user,
      calls: [
        isRelease
          ? buildResolutionRewardReleaseCall(proposal.proposalId)
          : buildResolutionRewardWithdrawalCall(proposal.proposalId),
      ],
      metadata: isRelease ? 'release_resolution_reward_bond' : 'request_resolution_reward_withdrawal',
      signTypedDataAsync,
    })

    if (response.error) {
      if (isTradingAuthRequiredError(response.error)) {
        openTradeRequirements({ forceTradingAuth: true })
      } else if (response.code === 'deadline_expired') {
        toast.error(t('Your signature expired. Click Sign again to create a fresh request.'))
      } else {
        toast.error(response.error ?? DEFAULT_ERROR_MESSAGE)
      }
      return false
    }

    return true
  }

  async function handleSubmit() {
    if (!user || !isConnected) {
      await openAppKit()
      return
    }
    if (!proposal) {
      return
    }
    if (!user?.deposit_wallet_address || user.deposit_wallet_status !== 'deployed') {
      openTradeRequirements()
      return
    }

    setIsSubmitting(true)
    try {
      const submitted = await runWithSignaturePrompt(submitWithdrawalAction, {
        title: isRelease ? t('Confirm bond release') : t('Confirm proposal cancellation'),
        description: isRelease
          ? t('Sign once to release the bond to your claimable balance.')
          : t('Sign once to start the 24-hour waiting period.'),
      })
      if (!submitted) {
        return
      }

      onOpenChange(false)
      onSubmitted?.()
      if (isRelease) {
        window.dispatchEvent(new Event('resolution-rewards-updated'))
        toast.success(t('Your funds were released. You can claim them now.'))
      } else {
        toast.success(t('Cancellation requested. Your 24-hour wait has started.'))
      }
    } catch (error) {
      console.error('Failed to update resolution reward proposal.', error)
      toast.error(
        isRelease
          ? t('Could not release your bond. Please try again.')
          : t('Could not cancel your proposal. Please try again.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pb-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isRelease ? t('Release your bond') : t('Cancel proposal')}</DialogTitle>
          <DialogDescription className="line-clamp-2">{marketTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{t('Your proposal')}</p>
              <p className="mt-0.5 text-sm font-semibold">{side}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{t('Bond')}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{formattedBond}</p>
            </div>
          </div>

          {isRelease ? (
            <div className="grid justify-items-center gap-3 rounded-xl border border-yes/20 bg-yes/5 px-5 py-6 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-yes/12 text-yes">
                <LockOpenIcon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{t('The 24-hour wait is complete')}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t('Release the bond to make it available in your Rewards claim balance.')}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-muted/10">
                <div className="grid min-w-0 justify-items-center gap-1.5 px-2 py-3 text-center">
                  <GiftIcon className="size-4 text-violet-500" aria-hidden />
                  <p className="text-xs font-semibold">{t('Reward waived')}</p>
                  <p className="text-xs text-muted-foreground">{t('Immediately')}</p>
                </div>
                <div className="grid min-w-0 justify-items-center gap-1.5 px-2 py-3 text-center">
                  <HourglassIcon className="size-4 text-orange-500" aria-hidden />
                  <p className="text-xs font-semibold">{t('Bond at risk')}</p>
                  <p className="text-xs text-muted-foreground">{t('For 24 hours')}</p>
                </div>
                <div className="grid min-w-0 justify-items-center gap-1.5 px-2 py-3 text-center">
                  <LockOpenIcon className="size-4 text-yes" aria-hidden />
                  <p className="text-xs font-semibold">{t('Ready to release')}</p>
                  <p className="text-xs text-muted-foreground">{t('After the wait')}</p>
                </div>
              </div>

              <div className="grid gap-2 px-1">
                <p className="text-xs font-semibold text-foreground">{t('If the market resolves during the wait')}</p>
                <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-yes" aria-hidden />
                  <span>{t('Correct: your bond returns, but the reward is waived.')}</span>
                </div>
                <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-no" aria-hidden />
                  <span>{t('Incorrect: your bond is forfeited.')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 -mx-6 border-t border-border/50 bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('Back')}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !proposal}>
            {isSubmitting ? (
              <Spinner className="size-4" />
            ) : isRelease ? (
              <LockOpenIcon className="size-4" aria-hidden />
            ) : (
              <RotateCcwIcon className="size-4" aria-hidden />
            )}
            {isSubmitting
              ? t('Submitting...')
              : isRelease
                ? t('Release {bond} bond', { bond: formattedBond })
                : t('Start 24-hour wait')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
