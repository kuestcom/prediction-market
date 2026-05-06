import { InfoIcon } from 'lucide-react'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import AdminAffiliateOverview from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateOverview'
import AdminAffiliateSettingsForm from '@/app/[locale]/admin/affiliate/_components/AdminAffiliateSettingsForm'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAffiliateFeeSettings, getAffiliateFeeSettingsUpdatedAt } from '@/lib/affiliate-fee-settings'
import { fetchKuestFeeSettings } from '@/lib/clob-fees'
import { baseUnitsToNumber, fetchFeeReceiverTotals, sumFeeTotals, sumFeeVolumes } from '@/lib/data-api/fees'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { usdFormatter } from '@/lib/formatters'
import { getPublicAssetUrl } from '@/lib/storage'

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
    <>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-h-96 rounded-lg border bg-background" />
        <div className="min-h-64 rounded-lg border bg-background" />
      </section>
      <div className="min-h-80 rounded-lg border bg-background" />
    </>
  )
}

async function AdminAffiliateContent() {
  await connection()
  const t = await getExtracted()

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
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <AdminAffiliateSettingsForm
          builderTakerFeeBps={affiliateFeeSettings.builderTakerFeeBps}
          builderMakerFeeBps={affiliateFeeSettings.builderMakerFeeBps}
          affiliateShareBps={affiliateFeeSettings.affiliateShareBps}
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
              <p className="mt-1 text-2xl font-semibold">
                {usdFormatter.format(aggregate.totalVolume)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground uppercase">{t('Affiliate fees')}</p>
              <div className="mt-1 flex items-center gap-1 text-2xl font-semibold">
                <span>{usdFormatter.format(aggregate.totalAffiliateFees)}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`
                        inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground
                        transition-colors
                        hover:text-foreground
                        focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none
                      `}
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
          </div>
        </div>
      </section>
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
