import { setRequestLocale } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'
import { AdminPanelSkeleton } from '@/app/[locale]/admin/_components/AdminPageSkeleton'
import AdminAffiliateContentClient from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateContentClient'
import AdminAffiliateOverview from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateOverview'
import { getAffiliateFeeSettings, getAffiliateFeeSettingsUpdatedAt } from '@/lib/affiliate-fee-settings'
import { fetchKuestFeeSettings } from '@/lib/clob-fees'
import { baseUnitsToNumber, fetchFeeReceiverTotals, sumFeeTotals, sumFeeVolumes } from '@/lib/data-api/fees'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getPublicAssetUrl } from '@/lib/storage'
import { getFeeRecipientWalletFormValue } from '@/lib/theme-settings'

interface AffiliateOverviewRow {
  affiliate_user_id: string
  total_referrals: number | null
  volume: number | null
}

interface AffiliateProfile {
  id: string
  username: string
  address: string
  deposit_wallet_address?: string | null
  image?: string | null
  affiliate_code?: string | null
}

interface RowSummary {
  id: string
  username: string
  address: string
  deposit_wallet_address?: string | null
  image: string
  affiliate_code: string | null
  total_referrals: number
  volume: number
  total_affiliate_fees: number
}

function formatIsoUtcFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString()
}

function AdminAffiliateFallback() {
  return (
    <div className="grid gap-6" role="status" aria-label="Loading affiliate settings">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <AdminPanelSkeleton className="min-h-96" rowCount={4} />
        <AdminPanelSkeleton className="min-h-64" rowCount={2} />
      </section>
      <AdminPanelSkeleton className="min-h-80" rowCount={3} />
    </div>
  )
}

async function AdminAffiliateContent() {
  await io()
  const [
    { data: allSettings },
    { data: overviewData },
    kuestFeeSettings,
  ] = await Promise.all([
    SettingsRepository.getSettings(),
    AffiliateRepository.listAffiliateOverview(),
    fetchKuestFeeSettings(),
  ])
  const affiliateFeeSettings = getAffiliateFeeSettings(allSettings)
  const initialFeeRecipientWallet = getFeeRecipientWalletFormValue(allSettings ?? undefined)

  const overview = (overviewData ?? []) as AffiliateOverviewRow[]
  const userIds = overview.map(row => row.affiliate_user_id)
  const { data: profilesData } = await AffiliateRepository.getAffiliateProfiles(userIds)
  const profiles = (profilesData ?? []) as AffiliateProfile[]

  let updatedAtLabel: string | undefined
  const latestUpdatedAt = getAffiliateFeeSettingsUpdatedAt(allSettings)

  if (latestUpdatedAt) {
    const latestUpdatedAtMs = Date.parse(latestUpdatedAt)
    if (Number.isFinite(latestUpdatedAtMs)) {
      const iso = formatIsoUtcFromTimestamp(latestUpdatedAtMs)
      updatedAtLabel = `${iso.replace('T', ' ').slice(0, 19)} UTC`
    }
  }

  const profileMap = new Map<string, AffiliateProfile>(profiles.map(profile => [profile.id, profile]))
  const feeTotalsByAddress = new Map<string, { fees: number, volume: number }>()

  if (profiles.length > 0) {
    const uniqueReceivers = Array.from(
      new Set(
        profiles
          .map(profile => profile.deposit_wallet_address || profile.address || '')
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
      const volumeTotal = sumFeeVolumes(result.value)
      feeTotalsByAddress.set(
        uniqueReceivers[idx].toLowerCase(),
        {
          fees: baseUnitsToNumber(usdcTotal, 6),
          volume: baseUnitsToNumber(volumeTotal, 6),
        },
      )
    })
  }

  const rows: RowSummary[] = overview.map((item) => {
    const profile = profileMap.get(item.affiliate_user_id)

    const receiverAddress = (profile?.deposit_wallet_address || profile?.address || '').toLowerCase()
    const onchainData = receiverAddress ? feeTotalsByAddress.get(receiverAddress) : undefined

    return {
      id: item.affiliate_user_id,
      username: profile?.username as string,
      address: profile?.address ?? '',
      deposit_wallet_address: profile?.deposit_wallet_address ?? null,
      image: profile?.image ? getPublicAssetUrl(profile.image) : '',
      affiliate_code: profile?.affiliate_code ?? null,
      total_referrals: Number(item.total_referrals ?? 0),
      volume: onchainData?.volume ?? 0,
      total_affiliate_fees: onchainData?.fees ?? 0,
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
      <AdminAffiliateContentClient
        builderTakerFeeBps={affiliateFeeSettings.builderTakerFeeBps}
        builderMakerFeeBps={affiliateFeeSettings.builderMakerFeeBps}
        affiliateShareBps={affiliateFeeSettings.affiliateShareBps}
        initialFeeRecipientWallet={initialFeeRecipientWallet}
        kuestFeeSettings={kuestFeeSettings}
        updatedAtLabel={updatedAtLabel}
        aggregate={aggregate}
      />
      <AdminAffiliateOverview rows={rows} />
    </>
  )
}

export default async function AdminSettingsPage({ params }: PageProps<'/[locale]/admin/affiliate'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<AdminAffiliateFallback />}>
      <AdminAffiliateContent />
    </Suspense>
  )
}
