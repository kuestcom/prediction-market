'use client'

import { InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useState } from 'react'

import AdminAffiliateClaimableFeesCard from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateClaimableFeesCard'
import AdminAffiliateFeeChart from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateFeeChart'
import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { usdFormatter } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface AdminAffiliateContentClientProps {
  builderTakerFeeShareBps: number
  builderMakerFlatFeeBps: number
  affiliateShareBps: number
  hasSavedBuilderTakerShare: boolean
  initialFeeRecipientWallet: string
  updatedAtLabel?: string
  aggregate: {
    totalVolume: number
    totalAffiliateFees: number
    totalReferrals: number
  }
}

export default function AdminAffiliateContentClient({
  builderTakerFeeShareBps,
  builderMakerFlatFeeBps,
  affiliateShareBps,
  hasSavedBuilderTakerShare,
  initialFeeRecipientWallet,
  updatedAtLabel,
  aggregate,
}: AdminAffiliateContentClientProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const [operatorSharePercent, setOperatorSharePercent] = useState(() =>
    Math.min(45, Math.max(20, builderTakerFeeShareBps / 100 || 30)),
  )

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-lg border p-6">
        <div>
          <h2 className="text-xl font-semibold">{t('Earnings')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Track your fees, affiliate performance, and claimable balance')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminAffiliateClaimableFeesCard feeRecipientWallet={initialFeeRecipientWallet} />
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground uppercase">{t('Affiliate fees')}</p>
            <div className="mt-1 flex items-center gap-1 text-2xl font-semibold">
              <span>{usdFormatter.format(aggregate.totalAffiliateFees)}</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        `inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none`,
                      )}
                      aria-label={t('Affiliate fee info')}
                    >
                      <InfoIcon className="size-3" aria-hidden />
                    </button>
                  }
                />
                <TooltipContent side="top" className="max-w-64 text-left">
                  {t('Commission is taken from operator fees at execution, not from volume.')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground uppercase">{t('Affiliate Volume')}</p>
            <p className="mt-1 text-2xl font-semibold">{usdFormatter.format(aggregate.totalVolume)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground uppercase">{t('Total referrals')}</p>
            <p className="mt-1 text-2xl font-semibold">{aggregate.totalReferrals}</p>
          </div>
        </div>
      </div>
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminAffiliateSettingsForm
          key={`${initialFeeRecipientWallet}-${builderTakerFeeShareBps}`}
          builderTakerFeeShareBps={builderTakerFeeShareBps}
          builderMakerFlatFeeBps={builderMakerFlatFeeBps}
          affiliateShareBps={affiliateShareBps}
          hasSavedBuilderTakerShare={hasSavedBuilderTakerShare}
          initialFeeRecipientWallet={initialFeeRecipientWallet}
          updatedAtLabel={updatedAtLabel}
          onOperatorShareChange={setOperatorSharePercent}
        />
        <AdminAffiliateFeeChart operatorSharePercent={operatorSharePercent} siteName={site.name} />
      </div>
    </section>
  )
}
