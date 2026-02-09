'use cache'

import { setRequestLocale } from 'next-intl/server'
import AdminAffiliateOverview from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateOverview'
import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'
import { baseUnitsToNumber, fetchFeeReceiverTotals, sumFeeTotals } from '@/lib/data-api/fees'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { fetchMaxExchangeBaseFeeRate } from '@/lib/exchange'
import { usdFormatter } from '@/lib/formatters'
import { getSupabaseImageUrl } from '@/lib/supabase'

interface AffiliateOverviewRow {
  affiliate_user_id: string
  total_referrals: number | null
  volume: number | null
}

interface AffiliateProfile {
  id: string
  username: string
  address: string
  proxy_wallet_address?: string | null
  image?: string | null
  affiliate_code?: string | null
}

interface RowSummary {
  id: string
  username: string
  address: string
  proxy_wallet_address?: string | null
  image: string
  affiliate_code: string | null
  total_referrals: number
  volume: number
  total_affiliate_fees: number
}

export default async function AdminSettingsPage({ params }: PageProps<'/[locale]/admin/affiliate'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const [
    { data: allSettings },
    { data: overviewData },
    exchangeBaseFeeBps,
  ] = await Promise.all([
    SettingsRepository.getSettings(),
    AffiliateRepository.listAffiliateOverview(),
    fetchMaxExchangeBaseFeeRate(),
  ])
  const affiliateSettings = allSettings?.affiliate

  const overview = (overviewData ?? []) as AffiliateOverviewRow[]
  const userIds = overview.map(row => row.affiliate_user_id)
  const { data: profilesData } = await AffiliateRepository.getAffiliateProfiles(userIds)
  const profiles = (profilesData ?? []) as AffiliateProfile[]

  let updatedAtLabel: string | undefined
  const tradeFeeUpdatedAt = affiliateSettings?.trade_fee_bps?.updated_at
  const shareUpdatedAt = affiliateSettings?.affiliate_share_bps?.updated_at
  const latestUpdatedAt
    = tradeFeeUpdatedAt && shareUpdatedAt
      ? new Date(tradeFeeUpdatedAt) > new Date(shareUpdatedAt)
        ? tradeFeeUpdatedAt
        : shareUpdatedAt
      : tradeFeeUpdatedAt || shareUpdatedAt

  if (latestUpdatedAt) {
    const date = new Date(latestUpdatedAt)
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString()
      updatedAtLabel = `${iso.replace('T', ' ').slice(0, 19)} UTC`
    }
  }

  const profileMap = new Map<string, AffiliateProfile>(profiles.map(profile => [profile.id, profile]))
  const feeTotalsByAddress = new Map<string, number>()

  if (profiles.length > 0) {
    const uniqueReceivers = Array.from(
      new Set(
        profiles
          .map(profile => profile.proxy_wallet_address || profile.address || '')
          .map(address => address.trim())
          .filter(Boolean),
      ),
    )

    const feeTotals = await Promise.allSettled(
      uniqueReceivers.map(address => fetchFeeReceiverTotals({ endpoint: 'referrers', address })),
    )

    feeTotals.forEach((result, idx) => {
      if (result.status !== 'fulfilled') {
        console.warn('Failed to load affiliate fee totals', result.reason)
        return
      }
      const usdcTotal = sumFeeTotals(result.value)
      feeTotalsByAddress.set(
        uniqueReceivers[idx].toLowerCase(),
        baseUnitsToNumber(usdcTotal, 6),
      )
    })
  }

  const rows: RowSummary[] = overview.map((item) => {
    const profile = profileMap.get(item.affiliate_user_id)

    const receiverAddress = (profile?.proxy_wallet_address || profile?.address || '').toLowerCase()
    const onchainFees = receiverAddress ? feeTotalsByAddress.get(receiverAddress) : undefined

    return {
      id: item.affiliate_user_id,
      username: profile?.username as string,
      address: profile?.address ?? '',
      proxy_wallet_address: profile?.proxy_wallet_address ?? null,
      image: profile?.image ? getSupabaseImageUrl(profile.image) : '',
      affiliate_code: profile?.affiliate_code ?? null,
      total_referrals: Number(item.total_referrals ?? 0),
      volume: Number(item.volume ?? 0),
      total_affiliate_fees: onchainFees ?? 0,
    }
  })

  const aggregate = rows.reduce<{ totalVolume: number, totalAffiliateFees: number, totalReferrals: number }>((acc, row) => {
    acc.totalVolume += row.volume
    acc.totalAffiliateFees += row.total_affiliate_fees
    acc.totalReferrals += row.total_referrals
    return acc
  }, { totalVolume: 0, totalAffiliateFees: 0, totalReferrals: 0 })

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <AdminAffiliateSettingsForm
          tradeFeeBps={Number.parseInt(affiliateSettings?.trade_fee_bps?.value || '100', 10)}
          affiliateShareBps={Number.parseInt(affiliateSettings?.affiliate_share_bps?.value || '5000', 10)}
          minTradeFeeBps={exchangeBaseFeeBps ?? 0}
          updatedAtLabel={updatedAtLabel}
        />
        <div className="grid gap-4 rounded-lg border p-6">
          <div>
            <h2 className="text-xl font-semibold">Totals</h2>
            <p className="text-sm text-muted-foreground">
              Consolidated affiliate performance across your platform.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground uppercase">Total referrals</p>
              <p className="mt-1 text-2xl font-semibold">{aggregate.totalReferrals}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground uppercase">Volume</p>
              <p className="mt-1 text-2xl font-semibold">
                {usdFormatter.format(aggregate.totalVolume)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground uppercase">Affiliate fees</p>
              <p className="mt-1 text-2xl font-semibold">
                {usdFormatter.format(aggregate.totalAffiliateFees)}
              </p>
            </div>
          </div>
        </div>
      </section>
      <AdminAffiliateOverview rows={rows} />
    </>
  )
}
