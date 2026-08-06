'use client'

import type { Route } from 'next'

import {
  ArrowUpRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  CopyIcon,
  LockKeyholeIcon,
} from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { DataApiRewardAccount, DataApiRewardProposal } from '@/lib/data-api/resolution-rewards'
import type { AffiliateData } from '@/types'

import AffiliateWidgetDialog from '@/app/[locale]/(platform)/settings/_components/AffiliateWidgetDialog'
import SettingsAffiliateFeeClaim from '@/app/[locale]/(platform)/settings/_components/SettingsAffiliateFeeClaim'
import SettingsResolutionRewardsClaim from '@/app/[locale]/(platform)/settings/_components/SettingsResolutionRewardsClaim'
import SettingsResolutionWithdrawalDialog from '@/app/[locale]/(platform)/settings/_components/SettingsResolutionWithdrawalDialog'
import SettingsRewardsChart from '@/app/[locale]/(platform)/settings/_components/SettingsRewardsChart'
import EventIconImage from '@/components/EventIconImage'
import ProfileLink from '@/components/ProfileLink'
import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/useClipboard'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { Link } from '@/i18n/navigation'
import { resolveEventMarketPath } from '@/lib/events-routing'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { buildPublicProfilePath } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

interface AffiliateMainCategory {
  slug: string
  name: string
}

interface WithdrawalSelection {
  action: 'request' | 'release'
  marketTitle: string
  proposal: DataApiRewardProposal
}

interface SettingsAffiliateContentProps {
  affiliateData?: AffiliateData
  affiliateSeries: Array<{ date: string; value: number }>
  currentTimestamp: number
  mainCategories: AffiliateMainCategory[]
  resolutionAccount: DataApiRewardAccount
  resolutionSeries: Array<{ date: string; value: number }>
}

function fromBaseUnits(value: string): number {
  try {
    return Number(BigInt(value)) / 1_000_000
  } catch {
    return 0
  }
}

function formatBondAmount(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SettingsAffiliateContent({
  affiliateData,
  affiliateSeries,
  currentTimestamp,
  mainCategories,
  resolutionAccount,
  resolutionSeries,
}: SettingsAffiliateContentProps) {
  const t = useExtracted()
  const locale = useLocale()
  const router = useRouter()
  const { copied, copy } = useClipboard()
  const [isWidgetDialogOpen, setIsWidgetDialogOpen] = useState(false)
  const [withdrawalSelection, setWithdrawalSelection] = useState<WithdrawalSelection | null>(null)
  const liveCurrentTimestamp = Math.floor(
    (useCurrentTimestamp({ initialTimestamp: currentTimestamp * 1_000, intervalMs: 30_000 }) ??
      currentTimestamp * 1_000) / 1_000,
  )

  const { rewardAccountStats: rewardStats, rewardProposals } = resolutionAccount
  const correct = Number(rewardStats?.correct ?? 0)
  const incorrect = Number(rewardStats?.incorrect ?? 0)
  const resolved = correct + incorrect
  const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0
  const activeProposals = rewardProposals.filter((proposal) => {
    if (proposal.status === 'active') {
      return true
    }
    if (proposal.status !== 'withdrawal_pending') {
      return false
    }
    return !proposal.withdrawalAvailableAt || Number(proposal.withdrawalAvailableAt) > liveCurrentTimestamp
  })
  const bondAtRisk = activeProposals.reduce((sum, proposal) => sum + fromBaseUnits(proposal.bondAmount), 0)
  const recentProposals = [...rewardProposals].sort(
    (first, second) => Number(second.submittedAt) - Number(first.submittedAt),
  )
  const recentReferrals = [...(affiliateData?.recentReferrals ?? [])].sort(
    (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  )
  const referralUrl = affiliateData?.referralUrl ?? ''

  function handleCopyReferralUrl() {
    void copy(referralUrl)
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsAffiliateFeeClaim lifetimeEarned={Number(affiliateData?.stats.total_affiliate_fees ?? 0)} />
        <SettingsResolutionRewardsClaim stats={rewardStats} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="order-2 min-h-64 overflow-hidden rounded-xl border bg-background">
          <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
            <div className="min-w-0">
              <h2 className="font-semibold">{t('Resolution activity')}</h2>
              <p className="text-xs text-muted-foreground">{t('Your proposals and performance')}</p>
            </div>
            <span className="rounded-md border bg-muted/25 px-2 py-1 font-mono text-xs text-muted-foreground">
              {accuracy}% {t('accuracy')}
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x border-b">
            <div className="min-w-0 p-3">
              <p className="text-xl font-semibold tracking-tight">{formatBondAmount(bondAtRisk)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                <LockKeyholeIcon className="size-3.5 shrink-0" aria-hidden />
                {t('Bond at risk')}
              </p>
            </div>
            <div className="min-w-0 p-3">
              <p className="text-xl font-semibold tracking-tight">{correct}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                <CircleCheckIcon className="size-3.5 shrink-0 text-yes" aria-hidden />
                {t('Correct')}
              </p>
            </div>
            <div className="min-w-0 p-3">
              <p className="text-xl font-semibold tracking-tight">{incorrect}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                <CircleXIcon className="size-3.5 shrink-0 text-no" aria-hidden />
                {t('Incorrect')}
              </p>
            </div>
          </div>

          <div className="max-h-72 divide-y overflow-y-auto">
            {recentProposals.length === 0 && (
              <div className="px-5 py-4 text-center">
                <BadgeCheckIcon className="mx-auto size-5 text-violet-500/50" aria-hidden />
                <p className="mt-2 text-sm font-medium">{t('No resolution proposals yet')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('Proposals you submit on markets will appear here.')}
                </p>
              </div>
            )}
            {recentProposals.map((proposal) => {
              const rewardAmount = fromBaseUnits(proposal.rewardAmount)
              const market = proposal.market
              const marketTitle = market.title || `${t('Resolution')} #${proposal.id}`
              const marketHref =
                market.eventSlug && market.marketSlug
                  ? (resolveEventMarketPath(
                      {
                        slug: market.eventSlug,
                        main_tag: null,
                        sports_event_slug: null,
                        sports_sport_slug: null,
                        sports_league_slug: null,
                      },
                      market.marketSlug,
                    ) as Route)
                  : null
              const canRequestWithdrawal =
                proposal.status === 'active' &&
                Number(proposal.submittedAt) + Number(market.lockDuration) <= liveCurrentTimestamp
              const canReleaseBond =
                proposal.status === 'withdrawal_pending' &&
                Boolean(proposal.withdrawalAvailableAt) &&
                Number(proposal.withdrawalAvailableAt) <= liveCurrentTimestamp
              const withdrawalAction = canReleaseBond ? 'release' : canRequestWithdrawal ? 'request' : null
              const marketIcon = market.icon ? (
                <EventIconImage
                  src={market.icon}
                  alt={marketTitle}
                  sizes="36px"
                  containerClassName="size-9 shrink-0 rounded-md"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-violet-500/8 text-violet-500">
                  <BadgeCheckIcon className="size-4" aria-hidden />
                </span>
              )

              return (
                <div
                  key={proposal.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/25 sm:px-5"
                >
                  {marketHref ? (
                    <Link
                      href={marketHref}
                      className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {marketIcon}
                    </Link>
                  ) : (
                    marketIcon
                  )}
                  <div className="min-w-0 flex-1">
                    {marketHref ? (
                      <Link
                        href={marketHref}
                        className="block truncate text-sm font-medium hover:underline"
                        title={marketTitle}
                      >
                        {marketTitle}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium" title={marketTitle}>
                        {marketTitle}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(Number(proposal.submittedAt) * 1_000).toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC',
                        })}
                      </span>
                      {rewardAmount > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-semibold text-yes">+{formatCurrency(rewardAmount)}</span>
                        </>
                      )}
                      {withdrawalAction && (
                        <>
                          <span aria-hidden>·</span>
                          <button
                            type="button"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            onClick={() => setWithdrawalSelection({ action: withdrawalAction, marketTitle, proposal })}
                          >
                            {withdrawalAction === 'release' ? t('Release bond') : t('Start 24-hour wait')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'relative grid h-7 min-w-11 shrink-0 place-items-center rounded-md border px-2 font-mono text-xs font-semibold',
                      proposal.side === 2 ? 'border-yes/25 bg-yes/8 text-yes' : 'border-no/25 bg-no/8 text-no',
                    )}
                  >
                    {proposal.correct === true && (
                      <CircleCheckIcon
                        className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background text-yes"
                        aria-hidden
                      />
                    )}
                    {proposal.correct === false && (
                      <CircleXIcon
                        className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background text-no"
                        aria-hidden
                      />
                    )}
                    {proposal.side === 2 ? 'YES' : 'NO'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="order-1 min-h-64 overflow-hidden rounded-xl border bg-background">
          <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
            <div className="min-w-0">
              <h2 className="font-semibold">{t('Affiliate link')}</h2>
              <p className="text-xs whitespace-nowrap text-muted-foreground">
                {t('Share and earn as your network trades')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setIsWidgetDialogOpen(true)}
              disabled={!affiliateData || mainCategories.length === 0}
            >
              <span className="hidden sm:inline">{t('Create Widget')}</span>
              <span className="sm:hidden">{t('Widget')}</span>
              <ArrowUpRightIcon className="size-3.5" aria-hidden />
            </Button>
          </div>

          {affiliateData ? (
            <div className="p-4 sm:p-5">
              <button
                type="button"
                onClick={handleCopyReferralUrl}
                className="flex w-full items-center gap-3 rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1 truncate text-sm" title={referralUrl}>
                  {referralUrl}
                </span>
                {copied ? (
                  <CheckIcon className="size-4 shrink-0 text-yes" aria-hidden />
                ) : (
                  <CopyIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>

              <div className="mt-4 grid grid-cols-3 divide-x rounded-lg border">
                <div className="p-3 text-center">
                  <p className="text-xl font-semibold">{affiliateData.stats.total_referrals}</p>
                  <p className="text-xs text-muted-foreground">{t('Referrals')}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xl font-semibold">
                    {formatCurrency(Number(affiliateData.stats.volume ?? 0), {
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('Volume')}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xl font-semibold">
                    {formatPercent(affiliateData.commissionPercent, {
                      digits: Number.isInteger(affiliateData.commissionPercent) ? 0 : 2,
                    })}
                  </p>
                  <p className="text-xs whitespace-nowrap text-muted-foreground">{t('of trading fees')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              {t('Unable to load rewards information. Please try again later.')}
            </div>
          )}

          {recentReferrals.length > 0 && (
            <>
              <div className="border-t px-4 py-3 sm:px-5">
                <p className="text-xs font-medium text-muted-foreground uppercase">{t('Recent referrals')}</p>
              </div>
              <div className="max-h-72 divide-y overflow-y-auto">
                {recentReferrals.map((referral) => {
                  const profileSlug = referral.address || referral.username
                  return (
                    <div key={referral.user_id} className="px-4 py-3 sm:px-5">
                      <ProfileLink
                        user={{
                          image: referral.image ?? '',
                          username: referral.username,
                          address: referral.address,
                          deposit_wallet_address: referral.deposit_wallet_address ?? null,
                        }}
                        profileHref={profileSlug ? (buildPublicProfilePath(profileSlug) ?? undefined) : undefined}
                        layout="stacked"
                        avatarSize={30}
                        containerClassName="gap-3"
                        usernameClassName="text-sm font-medium text-foreground"
                        usernameMaxWidthClassName="max-w-48 sm:max-w-64"
                      >
                        <p className="text-xs text-muted-foreground">
                          {t('Joined')} {new Date(referral.created_at).toLocaleDateString(locale)}
                        </p>
                      </ProfileLink>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <SettingsRewardsChart affiliateSeries={affiliateSeries} resolutionSeries={resolutionSeries} />

      {affiliateData && (
        <AffiliateWidgetDialog
          open={isWidgetDialogOpen}
          onOpenChange={setIsWidgetDialogOpen}
          categories={mainCategories}
        />
      )}

      <SettingsResolutionWithdrawalDialog
        action={withdrawalSelection?.action ?? 'request'}
        marketTitle={withdrawalSelection?.marketTitle ?? ''}
        open={withdrawalSelection !== null}
        proposal={withdrawalSelection?.proposal ?? null}
        onOpenChange={(open) => !open && setWithdrawalSelection(null)}
        onSubmitted={() => router.refresh()}
      />
    </div>
  )
}
