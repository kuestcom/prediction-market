import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicProfileHeroCards from '@/app/[locale]/(platform)/profile/_components/PublicProfileHeroCards'
import PublicProfileTabs from '@/app/[locale]/(platform)/profile/_components/PublicProfileTabs'
import { UserRepository } from '@/lib/db/queries/user'
import { truncateAddress } from '@/lib/formatters'
import { normalizePublicProfileSlug } from '@/lib/platform-routing'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'

export function buildPublicProfileMetadata(slug: string): Metadata {
  const normalized = normalizePublicProfileSlug(slug)

  const displayName = normalized.type === 'address'
    ? truncateAddress(normalized.value)
    : normalized.type === 'username'
      ? normalized.value
      : slug

  return {
    title: `${displayName} - Profile`,
  }
}

export async function PublicProfilePageContent({ slug }: { slug: string }) {
  const fallbackChartEndDate = new Date().toISOString()
  const normalized = normalizePublicProfileSlug(slug)
  if (normalized.type === 'invalid') {
    notFound()
  }

  const { data: profile } = await UserRepository.getProfileByUsernameOrProxyAddress(normalized.value)

  if (!profile) {
    if (normalized.type === 'username') {
      notFound()
    }

    const snapshot = await fetchPortfolioSnapshot(normalized.value)

    return (
      <>
        <PublicProfileHeroCards
          profile={{
            username: 'Anon',
            avatarUrl: '',
            joinedAt: undefined,
            portfolioAddress: normalized.value,
          }}
          snapshot={snapshot}
          fallbackChartEndDate={fallbackChartEndDate}
        />
        <PublicProfileTabs userAddress={normalized.value} />
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
        fallbackChartEndDate={fallbackChartEndDate}
      />
      <PublicProfileTabs userAddress={userAddress} />
    </>
  )
}
