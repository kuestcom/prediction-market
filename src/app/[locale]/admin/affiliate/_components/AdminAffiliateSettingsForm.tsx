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

const initialState = {
  error: null,
}

interface AdminAffiliateSettingsFormProps {
  tradeFeeBps: number
  affiliateShareBps: number
  minTradeFeeBps?: number
  updatedAtLabel?: string
}

export default function AdminAffiliateSettingsForm({
  tradeFeeBps,
  affiliateShareBps,
  minTradeFeeBps = 0,
  updatedAtLabel,
}: AdminAffiliateSettingsFormProps) {
  const t = useExtracted()
  const [state, formAction, isPending] = useActionState(updateForkSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)
  const minTradeFeePercent = (minTradeFeeBps / 100).toFixed(2)

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success(t('Settings updated successfully!'))
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, state.error, t])

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <div>
        <h2 className="text-xl font-semibold">{t('Trading Fees')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('Configure the trading fee charged on your platform and the share paid to affiliates.')}
        </p>
        {updatedAtLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Last updated {timestamp}', { timestamp: updatedAtLabel })}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="trade_fee_percent">{t('Trading fee (%)')}</Label>
          <Input
            id="trade_fee_percent"
            name="trade_fee_percent"
            type="number"
            step="0.01"
            min={minTradeFeePercent}
            max="9"
            defaultValue={(tradeFeeBps / 100).toFixed(2)}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            {t('Minimum {value}% (onchain base fee)', { value: minTradeFeePercent })}
          </p>
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
            {t('Affiliate share of trading fee.')}
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
