'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import PublicProfileHeroCards from '@/app/[locale]/(platform)/[username]/_components/PublicProfileHeroCards'
import PublicProfileTabs from '@/app/[locale]/(platform)/[username]/_components/PublicProfileTabs'
import { UserRepository } from '@/lib/db/queries/user'
import { truncateAddress } from '@/lib/formatters'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { normalizeAddress } from '@/lib/wallet'

export async function generateMetadata({ params }: PageProps<'/[locale]/[username]'>): Promise<Metadata> {
  const { locale, username } = await params
  setRequestLocale(locale)
  if (username === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const isUsername = !username.startsWith('0x')
  const displayName = isUsername ? username : truncateAddress(username)

  return {
    title: `${displayName} - Profile`,
  }
}

export async function generateStaticParams() {
  return [{ username: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function ProfilePage({ params }: PageProps<'/[locale]/[username]'>) {
  const { locale, username } = await params
  setRequestLocale(locale)
  if (username === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const { data: profile } = await UserRepository.getProfileByUsernameOrProxyAddress(username)
  if (!profile) {
    const normalizedAddress = normalizeAddress(username)
    if (!normalizedAddress) {
      notFound()
    }

    const snapshot = await fetchPortfolioSnapshot(normalizedAddress)

    return (
      <>
        <PublicProfileHeroCards
          profile={{
            username: 'Anon',
            avatarUrl: `https://avatar.vercel.sh/${normalizedAddress}.png`,
            joinedAt: undefined,
            portfolioAddress: normalizedAddress,
          }}
          snapshot={snapshot}
        />
        <PublicProfileTabs userAddress={normalizedAddress} />
      </>
    )
  }

  const userAddress = profile.proxy_wallet_address!
  const snapshot = await fetchPortfolioSnapshot(userAddress)

  return (
    <>
      <PublicProfileHeroCards
        profile={{
          username: profile.username,
          avatarUrl: profile.image,
          joinedAt: profile.created_at?.toString(),
          portfolioAddress: userAddress,
        }}
        snapshot={snapshot}
      />
      <PublicProfileTabs userAddress={userAddress} />
    </>
  )
}
