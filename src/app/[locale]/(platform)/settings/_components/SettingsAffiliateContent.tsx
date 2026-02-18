'use client'

import type { AffiliateData } from '@/types'
import { BadgePercentIcon, CheckIcon, CopyIcon, InfoIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useState } from 'react'
import AffiliateWidgetDialog from '@/app/[locale]/(platform)/settings/_components/AffiliateWidgetDialog'
import ProfileLink from '@/components/ProfileLink'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useClipboard } from '@/hooks/useClipboard'
import { formatCurrency, formatPercent } from '@/lib/formatters'

interface AffiliateMainCategory {
  slug: string
  name: string
}

interface SettingsAffiliateContentProps {
  affiliateData?: AffiliateData
  mainCategories: AffiliateMainCategory[]
}

export default function SettingsAffiliateContent({ affiliateData, mainCategories }: SettingsAffiliateContentProps) {
  const t = useExtracted()
  const locale = useLocale()
  const { copied, copy } = useClipboard()
  const [isWidgetDialogOpen, setIsWidgetDialogOpen] = useState(false)

  if (!affiliateData) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        {t('Unable to load affiliate information. Please try again later.')}
      </div>
    )
  }

  function handleCopyReferralUrl() {
    copy(affiliateData!.referralUrl)
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-lg border p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-lg font-semibold">{t('Referral link')}</h3>
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-sm text-muted-foreground" title={affiliateData.referralUrl}>
                {affiliateData.referralUrl}
              </span>
              <Button
                variant="ghost"
                type="button"
                size="icon"
                onClick={handleCopyReferralUrl}
                className="shrink-0"
                title={copied ? t('Copied!') : t('Copy referral link')}
              >
                {copied ? <CheckIcon className="size-4 text-yes" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <div className="flex items-center justify-start gap-1 text-lg font-medium text-primary sm:justify-end">
              <span>{formatPercent(affiliateData.commissionPercent)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`
                      inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors
                      hover:text-foreground
                      focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none
                    `}
                    aria-label={t('Commission info')}
                  >
                    <InfoIcon className="size-3" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-left">
                  {t('Commission is taken from the trading fee at execution, not from volume. The exchange base fee comes out first.')}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-sm text-muted-foreground">{t('Commission')}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Total referrals')}</p>
            <p className="mt-2 text-2xl font-semibold">{affiliateData.stats.total_referrals}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Active traders')}</p>
            <p className="mt-2 text-2xl font-semibold">{affiliateData.stats.active_referrals}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Referred volume')}</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(affiliateData.stats.volume ?? 0))}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('Earned fees')}</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(affiliateData.stats.total_affiliate_fees ?? 0))}</p>
          </div>
        </div>
        <div className="relative h-full overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
          <BadgePercentIcon
            className="pointer-events-none absolute -top-10 -right-10 size-48 text-muted-foreground/10"
            aria-hidden
          />
          <div className="relative z-10 flex h-full min-h-44 flex-col justify-between gap-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('Embed')}</p>
              <h3 className="max-w-64 text-xl font-semibold tracking-tight">
                {t('Generate widget to promote your referral link')}
              </h3>
              <p className="max-w-72 text-sm text-muted-foreground">
                {t('Build and copy a widget iframe with your affiliate reference tag included.')}
              </p>
            </div>
            <Button
              type="button"
              className="w-full sm:w-fit"
              onClick={() => setIsWidgetDialogOpen(true)}
              disabled={mainCategories.length === 0}
            >
              {t('Generate')}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4 sm:px-6">
          <h3 className="text-lg font-semibold">{t('Recent referrals')}</h3>
          <p className="text-sm text-muted-foreground">{t('Latest users who joined through your link.')}</p>
        </div>
        <div className="divide-y">
          {affiliateData.recentReferrals.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
              {t('No referrals yet. Share your link to get started.')}
            </div>
          )}
          {affiliateData.recentReferrals.map((referral) => {
            const profileSlug = referral.address || referral.username
            return (
              <div key={referral.user_id} className="p-4 sm:px-6">
                <ProfileLink
                  user={{
                    image: referral.image ?? '',
                    username: referral.username,
                    address: referral.address,
                    proxy_wallet_address: referral.proxy_wallet_address ?? null,
                  }}
                  profileHref={profileSlug ? `/profile/${profileSlug}` : undefined}
                  layout="stacked"
                  avatarSize={32}
                  containerClassName="gap-3"
                  usernameClassName="text-sm font-medium text-foreground"
                  usernameMaxWidthClassName="max-w-48 sm:max-w-64"
                >
                  <p className="text-xs text-muted-foreground">
                    {t('Joined')}
                    {' '}
                    {new Date(referral.created_at).toLocaleDateString(locale)}
                  </p>
                </ProfileLink>
              </div>
            )
          })}
        </div>
      </div>

      <AffiliateWidgetDialog
        open={isWidgetDialogOpen}
        onOpenChange={setIsWidgetDialogOpen}
        categories={mainCategories}
      />
    </div>
  )
}
