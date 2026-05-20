'use client'

import { InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import AdminAffiliateClaimableFeesCard from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateClaimableFeesCard'
import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usdFormatter } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface AdminAffiliateContentClientProps {
  builderTakerFeeBps: number
  builderMakerFeeBps: number
  affiliateShareBps: number
  initialFeeRecipientWallet: string
  kuestFeeSettings: {
    takerFeeBps: number | null
    makerFeeBps: number | null
  } | null
  updatedAtLabel?: string
  aggregate: {
    totalVolume: number
    totalAffiliateFees: number
    totalReferrals: number
  }
}

export default function AdminAffiliateContentClient({
  builderTakerFeeBps,
  builderMakerFeeBps,
  affiliateShareBps,
  initialFeeRecipientWallet,
  kuestFeeSettings,
  updatedAtLabel,
  aggregate,
}: AdminAffiliateContentClientProps) {
  const t = useExtracted()
  const [draftFeeRecipientWallet, setDraftFeeRecipientWallet] = useState(initialFeeRecipientWallet)

  useEffect(() => {
    setDraftFeeRecipientWallet(initialFeeRecipientWallet)
  }, [initialFeeRecipientWallet])

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <AdminAffiliateSettingsForm
        builderTakerFeeBps={builderTakerFeeBps}
        builderMakerFeeBps={builderMakerFeeBps}
        affiliateShareBps={affiliateShareBps}
        feeRecipientWallet={draftFeeRecipientWallet}
        onFeeRecipientWalletChange={setDraftFeeRecipientWallet}
        kuestFeeSettings={kuestFeeSettings}
        updatedAtLabel={updatedAtLabel}
      />
      <div className="grid gap-4 rounded-lg border p-6">
        <div>
          <h2 className="text-xl font-semibold">{t('Totals')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Consolidated affiliate performance across your platform.')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Total referrals')}</p>
            <p className="mt-1 text-2xl font-semibold">{aggregate.totalReferrals}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Volume')}</p>
            <p className="mt-1 text-2xl font-semibold">{usdFormatter.format(aggregate.totalVolume)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Affiliate fees')}</p>
            <div className="mt-1 flex items-center gap-1 text-2xl font-semibold">
              <span>{usdFormatter.format(aggregate.totalAffiliateFees)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(`
                      inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      hover:text-foreground
                      focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none
                    `)}
                    aria-label={t('Affiliate fee info')}
                  >
                    <InfoIcon className="size-3" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-left">
                  {t('Commission is taken from operator fees at execution, not from volume.')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <AdminAffiliateClaimableFeesCard feeRecipientWallet={initialFeeRecipientWallet} />
        </div>
      </div>
    </section>
  )
}
