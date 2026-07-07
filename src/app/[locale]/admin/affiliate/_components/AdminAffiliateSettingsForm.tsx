'use client'

import { InfoIcon, WalletIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateForkSettingsAction } from '@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBpsPercent } from '@/lib/affiliate-fee-settings'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const initialState = {
  error: null,
}

interface AdminAffiliateSettingsFormProps {
  builderTakerFeeBps: number
  builderMakerFeeBps: number
  affiliateShareBps: number
  initialFeeRecipientWallet: string
  kuestFeeSettings: {
    takerFeeBps: number | null
    makerFeeBps: number | null
  } | null
  updatedAtLabel?: string
}

interface AdminInfoTooltipProps {
  content: string
}

function AdminInfoTooltip({ content }: AdminInfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(`
            inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors
            hover:text-foreground
            focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none
          `)}
          aria-label={content}
        >
          <InfoIcon className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-left">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

function useAffiliateSettingsForm() {
  const t = useExtracted()
  const [state, formAction, isPending] = useActionState(updateForkSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  useEffect(function toastOnSettingsTransition() {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success(t('Settings updated successfully!'))
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, state.error, t])

  return { state, formAction, isPending }
}

export default function AdminAffiliateSettingsForm({
  builderTakerFeeBps,
  builderMakerFeeBps,
  affiliateShareBps,
  initialFeeRecipientWallet,
  kuestFeeSettings,
  updatedAtLabel,
}: AdminAffiliateSettingsFormProps) {
  const t = useExtracted()
  const user = useUser()
  const { state, formAction, isPending } = useAffiliateSettingsForm()
  const depositWalletAddress = user?.deposit_wallet_address ?? null
  const [feeRecipientWallet, setFeeRecipientWallet] = useState(initialFeeRecipientWallet)
  const takerKuestFeeLabel = kuestFeeSettings?.takerFeeBps === null || kuestFeeSettings?.takerFeeBps === undefined
    ? null
    : formatBpsPercent(kuestFeeSettings.takerFeeBps)
  const makerKuestFeeLabel = kuestFeeSettings?.makerFeeBps === null || kuestFeeSettings?.makerFeeBps === undefined
    ? null
    : formatBpsPercent(kuestFeeSettings.makerFeeBps)
  const updatedAtTooltip = updatedAtLabel
    ? t('Last fees updated {timestamp}', { timestamp: updatedAtLabel })
    : null
  const affiliateShareTooltip = t('Commission paid to your affiliates, deducted from your operator fee.')
  const normalizedFeeRecipientWallet = feeRecipientWallet.trim().toLowerCase()
  const normalizedDepositWallet = depositWalletAddress?.trim().toLowerCase() ?? null
  const shouldShowDepositWalletButton = Boolean(normalizedDepositWallet)
    && normalizedFeeRecipientWallet !== normalizedDepositWallet

  function handleUseDepositWallet() {
    if (depositWalletAddress) {
      setFeeRecipientWallet(depositWalletAddress)
    }
  }

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <div>
        <h2 className="text-xl font-semibold">{t('Trading Fees')}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <p>{t('Configure your operator fees and affiliate split.')}</p>
          {updatedAtTooltip && <AdminInfoTooltip content={updatedAtTooltip} />}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fee_recipient_wallet">
            {t('Fee Wallet Address (Polygon)')}
          </Label>
          <div className="flex w-full items-stretch">
            <Input
              id="fee_recipient_wallet"
              name="fee_recipient_wallet"
              maxLength={42}
              value={feeRecipientWallet}
              disabled={isPending}
              readOnly
              placeholder={t('0xabc')}
              className={shouldShowDepositWalletButton ? 'rounded-r-none border-r-0' : ''}
            />
            {shouldShowDepositWalletButton && (
              <Button
                type="button"
                variant="outline"
                className="rounded-l-none border-l-0 px-3"
                disabled={isPending}
                onClick={handleUseDepositWallet}
              >
                <WalletIcon className="size-4" aria-hidden />
                {t('Use my deposit wallet')}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="builder_taker_fee_percent">{t('Taker fee (%)')}</Label>
            <Input
              id="builder_taker_fee_percent"
              name="builder_taker_fee_percent"
              type="number"
              step="0.01"
              min="0"
              max="9"
              defaultValue={(builderTakerFeeBps / 100).toFixed(2)}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              {takerKuestFeeLabel
                ? t('Your fee plus Kuest {kuestFee}% fee.', { kuestFee: takerKuestFeeLabel })
                : t('Kuest fees unavailable.')}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="builder_maker_fee_percent">{t('Maker fee (%)')}</Label>
            <Input
              id="builder_maker_fee_percent"
              name="builder_maker_fee_percent"
              type="number"
              step="0.01"
              min="0"
              max="9"
              defaultValue={(builderMakerFeeBps / 100).toFixed(2)}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              {makerKuestFeeLabel
                ? t('Your fee plus Kuest {kuestFee}% fee.', { kuestFee: makerKuestFeeLabel })
                : t('Kuest fees unavailable.')}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="affiliate_share_percent">{t('Affiliate share (%)')}</Label>
              <AdminInfoTooltip content={affiliateShareTooltip} />
            </div>
            <Input
              id="affiliate_share_percent"
              name="affiliate_share_percent"
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={(affiliateShareBps / 100).toFixed(2)}
              disabled={isPending}
            />
          </div>
          <Button type="submit" className="w-full sm:w-40" disabled={isPending}>
            {isPending ? t('Saving...') : t('Save changes')}
          </Button>
        </div>
      </div>

      {state.error && <InputError message={state.error} />}
    </Form>
  )
}
