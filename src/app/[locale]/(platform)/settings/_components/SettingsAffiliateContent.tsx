'use client'

import type { AffiliateData } from '@/types'
import { CheckIcon, CopyIcon } from 'lucide-react'
import ProfileLink from '@/components/ProfileLink'
import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/useClipboard'
import { formatCurrency, formatPercent } from '@/lib/formatters'

interface SettingsAffiliateContentProps {
  affiliateData?: AffiliateData
}

export default function SettingsAffiliateContent({ affiliateData }: SettingsAffiliateContentProps) {
  const { copied, copy } = useClipboard()

  if (!affiliateData) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Unable to load affiliate information. Please try again later.
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
            <h3 className="text-lg font-semibold">Referral link</h3>
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
                title={copied ? 'Copied!' : 'Copy referral link'}
              >
                {copied ? <CheckIcon className="size-4 text-yes" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <div className="text-lg font-medium text-primary">{formatPercent(affiliateData.commissionPercent)}</div>
            <div className="text-sm text-muted-foreground">Commission</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase">Total referrals</p>
          <p className="mt-2 text-2xl font-semibold">{affiliateData.stats.total_referrals}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase">Active traders</p>
          <p className="mt-2 text-2xl font-semibold">{affiliateData.stats.active_referrals}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase">Referred volume</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(affiliateData.stats.volume ?? 0))}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground uppercase">Earned fees</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(affiliateData.stats.total_affiliate_fees ?? 0))}</p>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4 sm:px-6">
          <h3 className="text-lg font-semibold">Recent referrals</h3>
          <p className="text-sm text-muted-foreground">Latest users who joined through your link.</p>
        </div>
        <div className="divide-y">
          {affiliateData.recentReferrals.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
              No referrals yet. Share your link to get started.
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
                    Joined
                    {' '}
                    {new Date(referral.created_at).toLocaleDateString()}
                  </p>
                </ProfileLink>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
