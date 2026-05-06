import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { notFound } from 'next/navigation'
import PublicProfileHeroCards from '@/app/[locale]/(platform)/profile/_components/PublicProfileHeroCards'
import PublicProfileTabs from '@/app/[locale]/(platform)/profile/_components/PublicProfileTabs'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { UserRepository } from '@/lib/db/queries/user'
import { truncateAddress } from '@/lib/formatters'
import { normalizePublicProfileSlug } from '@/lib/platform-routing'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const { resolveSiteUrl } = siteUrlUtils

function buildLocalizedPagePath(path: string, locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) {
    return path
  }

  return `/${locale}${path}`
}

function buildPublicProfileOgImageUrl({
  locale,
  slug,
  version,
}: {
  locale: SupportedLocale
  slug: string
  version?: string | null
}) {
  const params = new URLSearchParams({
    locale,
    slug,
  })
  const normalizedVersion = version?.trim()
  if (normalizedVersion) {
    params.set('v', normalizedVersion)
  }

  const siteUrl = resolveSiteUrl(process.env)
  return new URL(`/api/og/profile?${params.toString()}`, siteUrl).toString()
}

function resolveProfileCanonicalSlug(slug: string, profileUsername: string | null | undefined) {
  const normalized = normalizePublicProfileSlug(slug)
  const normalizedProfileUsername = profileUsername?.trim().replace(/^@+/, '') ?? ''

  if (normalizedProfileUsername) {
    return `@${normalizedProfileUsername}`
  }

  if (normalized.type === 'username') {
    return `@${normalized.value}`
  }

  if (normalized.type === 'address') {
    return normalized.value
  }

  return slug
}

function resolveProfileTitleLabel(slug: string, profileUsername: string | null | undefined) {
  const normalized = normalizePublicProfileSlug(slug)
  const normalizedProfileUsername = profileUsername?.trim().replace(/^@+/, '') ?? ''

  if (normalizedProfileUsername) {
    return `@${normalizedProfileUsername}`
  }

  if (normalized.type === 'username') {
    return `@${normalized.value}`
  }

  if (normalized.type === 'address') {
    return truncateAddress(normalized.value)
  }

  return slug
}

function buildFallbackChartEndDate() {
  return new Date().toISOString()
}

export async function buildPublicProfileMetadata({
  slug,
  locale = DEFAULT_LOCALE,
}: {
  slug: string
  locale?: SupportedLocale
}): Promise<Metadata> {
  const normalized = normalizePublicProfileSlug(slug)
  const [runtimeTheme, profileResult] = await Promise.all([
    loadRuntimeThemeState(),
    normalized.type !== 'invalid'
      ? UserRepository.getProfileByUsernameOrDepositWalletAddress(normalized.value)
      : Promise.resolve({ data: null, error: null }),
  ])
  const profile = profileResult.data
  const siteName = runtimeTheme.site.name

  const titleLabel = resolveProfileTitleLabel(slug, profile?.username ?? null)
  const canonicalSlug = resolveProfileCanonicalSlug(slug, profile?.username ?? null)
  const pageUrl = new URL(
    buildLocalizedPagePath(`/${canonicalSlug}`, locale),
    resolveSiteUrl(process.env),
  ).toString()
  const imageUrl = buildPublicProfileOgImageUrl({
    locale,
    slug: canonicalSlug,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
  const description = `Check out this profile on ${siteName}.`
  const socialImage = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: `${titleLabel} on ${siteName}`,
    type: 'image/png',
  } as const

  return {
    title: `${titleLabel} on ${siteName}`,
    description,
    openGraph: {
      type: 'profile',
      url: pageUrl,
      title: `${titleLabel} on ${siteName}`,
      description,
      siteName,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titleLabel} on ${siteName}`,
      description,
      images: [socialImage],
    },
  }
}

export async function PublicProfilePageContent({ slug }: { slug: string }) {
  const normalized = normalizePublicProfileSlug(slug)
  if (normalized.type === 'invalid') {
    notFound()
  }

  const { data: profile } = await UserRepository.getProfileByUsernameOrDepositWalletAddress(normalized.value)

  if (!profile) {
    if (normalized.type === 'username') {
      notFound()
    }

    const snapshot = await fetchPortfolioSnapshot(normalized.value)
    const fallbackChartEndDate = buildFallbackChartEndDate()

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

  const userAddress = profile.deposit_wallet_address!
  const snapshot = await fetchPortfolioSnapshot(userAddress)
  const fallbackChartEndDate = buildFallbackChartEndDate()

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
