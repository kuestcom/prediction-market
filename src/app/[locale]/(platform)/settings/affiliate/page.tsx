import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import SettingsAffiliateContent from '@/app/[locale]/(platform)/settings/_components/SettingsAffiliateContent'
import { baseUnitsToNumber, fetchFeeReceiverTotals, sumFeeTotals, sumFeeVolumes } from '@/lib/data-api/fees'
import { AffiliateRepository } from '@/lib/db/queries/affiliate'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'

export async function generateMetadata({ params }: PageProps<'/[locale]/settings/affiliate'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return {
    title: t('Affiliate Settings'),
  }
}

export default async function AffiliateSettingsPage({ params }: PageProps<'/[locale]/settings/affiliate'>) {
  const { locale } = await params
  setRequestLocale(locale)

  await connection()

  const t = await getExtracted()

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  const affiliateCode = user.affiliate_code
  const receiverAddress = user.proxy_wallet_address ?? user.address

  const feeTotalsPromise = receiverAddress
    ? fetchFeeReceiverTotals({
        endpoint: 'referrers',
        address: receiverAddress,
      }).catch((error) => {
        console.warn('Failed to load affiliate fee totals', error)
        return null
      })
    : Promise.resolve(null)

  const [
    { data: allSettings },
    { data: statsData },
    { data: referralsData },
    feeTotals,
  ] = await Promise.all([
    SettingsRepository.getSettings(),
    AffiliateRepository.getUserAffiliateStats(user.id),
    AffiliateRepository.listReferralsByAffiliate(user.id),
    feeTotalsPromise,
  ])
  const affiliateSettings = allSettings?.affiliate
  let totalAffiliateFees = 0
  let referredVolume = 0

  if (feeTotals) {
    const usdcTotal = sumFeeTotals(feeTotals)
    const volumeTotal = sumFeeVolumes(feeTotals)
    totalAffiliateFees = baseUnitsToNumber(usdcTotal, 6)
    referredVolume = baseUnitsToNumber(volumeTotal, 6)
  }

  const tradeFeeBps = Number.parseInt(affiliateSettings?.trade_fee_bps?.value || '100', 10)
  const affiliateShareBps = Number.parseInt(affiliateSettings?.affiliate_share_bps?.value || '5000', 10)
  const commissionPercent = Number(tradeFeeBps * affiliateShareBps) / 1000000

  function resolveBaseUrl() {
    const raw = process.env.SITE_URL!

    return raw.startsWith('http') ? raw : `https://${raw}`
  }

  const affiliateData = affiliateCode
    ? {
        referralUrl: `${resolveBaseUrl()}/r/${affiliateCode}`,
        commissionPercent,
        stats: {
          total_referrals: Number(statsData?.total_referrals ?? 0),
          active_referrals: Number(statsData?.active_referrals ?? 0),
          volume: referredVolume,
          total_affiliate_fees: totalAffiliateFees,
        },
        recentReferrals: (referralsData ?? []).map((referral: any) => {
          const userInfo = (Array.isArray(referral.users) ? referral.users[0] : referral.users) as {
            username: string
            address?: string
            proxy_wallet_address?: string
            image?: string | null
          }
          return {
            user_id: referral.user_id as string,
            username: userInfo.username,
            address: (userInfo?.address as string | undefined) ?? referral.user_id as string,
            proxy_wallet_address: userInfo?.proxy_wallet_address as string | undefined,
            image: getSupabasePublicAssetUrl(userInfo?.image ?? null) ?? '',
            created_at: referral.created_at as string,
          }
        }),
      }
    : undefined

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Affiliate Program')}</h1>
        <p className="text-muted-foreground">
          {t('Share your referral link to earn a percentage of every trade from users you invite.')}
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsAffiliateContent affiliateData={affiliateData} />
      </div>
    </section>
  )
}
