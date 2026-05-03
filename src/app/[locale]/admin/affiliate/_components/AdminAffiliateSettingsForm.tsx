'use client'

import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { updateForkSettingsAction } from '@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { formatBpsPercent } from '@/lib/affiliate-fee-settings'

const initialState = {
  error: null,
}

interface AdminAffiliateSettingsFormProps {
  builderTakerFeeBps: number
  builderMakerFeeBps: number
  affiliateShareBps: number
  kuestFeeSettings: {
    takerFeeBps: number | null
    makerFeeBps: number | null
  } | null
  updatedAtLabel?: string
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
  kuestFeeSettings,
  updatedAtLabel,
}: AdminAffiliateSettingsFormProps) {
  const t = useExtracted()
  const { state, formAction, isPending } = useAffiliateSettingsForm()
  const hasKuestFees = kuestFeeSettings
    && (kuestFeeSettings.takerFeeBps !== null || kuestFeeSettings.makerFeeBps !== null)

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <div>
        <h2 className="text-xl font-semibold">{t('Trading Fees')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('Configure your operator fees and affiliate split.')}
        </p>
        {updatedAtLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Last updated {timestamp}', { timestamp: updatedAtLabel })}
          </p>
        )}
      </div>

      <div className="grid gap-4">
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
            <p className="text-xs text-muted-foreground">
              {t('Your fee on taking liquidity.')}
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
            <p className="text-xs text-muted-foreground">
              {t('Your fee on making liquidity.')}
            </p>
          </div>
        </div>

        <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">{t('Kuest fees')}</p>
          {hasKuestFees
            ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('Taker')}</span>
                    <span className="font-mono">
                      {kuestFeeSettings.takerFeeBps === null ? '-' : `${formatBpsPercent(kuestFeeSettings.takerFeeBps)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('Maker')}</span>
                    <span className="font-mono">
                      {kuestFeeSettings.makerFeeBps === null ? '-' : `${formatBpsPercent(kuestFeeSettings.makerFeeBps)}%`}
                    </span>
                  </div>
                </div>
              )
            : (
                <p className="text-xs text-muted-foreground">
                  {t('Kuest fees unavailable.')}
                </p>
              )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="affiliate_share_percent">{t('Affiliate share (%)')}</Label>
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
          <p className="text-xs text-muted-foreground">
            {t('Paid from your operator fee.')}
          </p>
        </div>
      </div>

      {state.error && <InputError message={state.error} />}

      <Button type="submit" className="ms-auto w-40" disabled={isPending}>
        {isPending ? t('Saving...') : t('Save changes')}
      </Button>
    </Form>
  )
}
