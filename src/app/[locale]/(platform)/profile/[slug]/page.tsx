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

function normalizeProfileSlug(slug: string) {
  const trimmed = slug.trim()
  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1).trim()
    return { type: 'username' as const, value: username }
  }
  const normalizedAddress = normalizeAddress(trimmed)
  if (normalizedAddress) {
    return { type: 'address' as const, value: normalizedAddress }
  }
  return { type: 'invalid' as const, value: trimmed }
}

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({ params }: PageProps<'/[locale]/profile/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const normalized = normalizeProfileSlug(slug)
  const displayName = normalized.type === 'address'
    ? truncateAddress(normalized.value)
    : normalized.type === 'username'
      ? normalized.value
      : slug

  return {
    title: `${displayName} - Profile`,
  }
}

export default async function ProfileSlugPage({ params }: PageProps<'/[locale]/profile/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const normalized = normalizeProfileSlug(slug)
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
      />
      <PublicProfileTabs userAddress={userAddress} />
    </>
  )
}
