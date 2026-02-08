import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import PublicProfileHeroCards from '@/app/[locale]/(platform)/[username]/_components/PublicProfileHeroCards'
import PendingDepositBanner from '@/app/[locale]/(platform)/portfolio/_components/PendingDepositBanner'
import PortfolioMarketsWonCard from '@/app/[locale]/(platform)/portfolio/_components/PortfolioMarketsWonCard'
import PortfolioTabs from '@/app/[locale]/(platform)/portfolio/_components/PortfolioTabs'
import PortfolioWalletActions from '@/app/[locale]/(platform)/portfolio/_components/PortfolioWalletActions'
import { UserRepository } from '@/lib/db/queries/user'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'

export const metadata: Metadata = {
  title: 'Portfolio',
}

export default async function PortfolioPage({ params }: PageProps<'/[locale]/portfolio'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await UserRepository.getCurrentUser()
  const userAddress = user?.proxy_wallet_address ?? ''
  const snapshotAddress = user?.proxy_wallet_address
  const publicAddress = user?.proxy_wallet_address ?? null
  const snapshot = await fetchPortfolioSnapshot(snapshotAddress)

  return (
    <>
      <PendingDepositBanner />
      <PublicProfileHeroCards
        profile={{
          username: user?.username ?? 'Your portfolio',
          avatarUrl: user?.image ?? '',
          joinedAt: (user as any)?.created_at?.toString?.() ?? (user as any)?.createdAt?.toString?.(),
          portfolioAddress: publicAddress ?? undefined,
        }}
        snapshot={snapshot}
        actions={<PortfolioWalletActions />}
        variant="portfolio"
      />

      <PortfolioMarketsWonCard proxyWalletAddress={publicAddress} />

      <PortfolioTabs userAddress={userAddress} />
    </>
  )
}
