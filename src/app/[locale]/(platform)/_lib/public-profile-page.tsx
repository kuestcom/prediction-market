import type { Metadata, Route } from 'next'

import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

import type { ProfileForCards } from '@/app/[locale]/(platform)/_components/ProfileOverviewCard'
import type { SupportedLocale } from '@/i18n/locales'
import type { CommunityProfile } from '@/lib/community-profile'
import type { DataApiRewardAccount } from '@/lib/data-api/resolution-rewards'

import PublicProfileHeroCards from '@/app/[locale]/(platform)/profile/_components/PublicProfileHeroCards'
import PublicProfileTabs from '@/app/[locale]/(platform)/profile/_components/PublicProfileTabs'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import {
  COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS,
  fetchCommunityProfileByAddress,
  fetchCommunityProfileByUsername,
} from '@/lib/community-profile'
import { UserRepository } from '@/lib/db/queries/user'
import { truncateAddress } from '@/lib/formatters'
import { resolveCommitSha } from '@/lib/git'
import { normalizePublicProfileSlug } from '@/lib/platform-routing'
import { fetchPortfolioSnapshot } from '@/lib/portfolio'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { fetchDisplayResolutionRewardAccount } from '@/lib/resolution-reward-display'
import resolveSiteUrl from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const PUBLIC_RESOLUTION_ACCOUNT_TIMEOUT_MS = 5_000

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

async function buildFallbackChartEndDate() {
  await connection()
  return new Date().toISOString()
}

function PublicProfileTabsFallback() {
  return (
    <div className="overflow-hidden rounded-2xl border" aria-busy="true">
      <div className="flex items-center gap-6 border-b p-4 sm:px-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-3 px-3 py-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}

function PublicProfileTabsSection({
  userAddress,
  resolutionAccount,
}: {
  userAddress: string
  resolutionAccount: DataApiRewardAccount | null
}) {
  return (
    <Suspense fallback={<PublicProfileTabsFallback />}>
      <PublicProfileTabs userAddress={userAddress} resolutionAccount={resolutionAccount} />
    </Suspense>
  )
}

async function loadPublicResolutionAccount(wallet: string) {
  return fetchDisplayResolutionRewardAccount(wallet, {
    signal: AbortSignal.timeout(PUBLIC_RESOLUTION_ACCOUNT_TIMEOUT_MS),
  }).catch((error) => {
    console.warn('Failed to load public resolution history', { wallet, error })
    return null
  })
}

function buildResolutionHistory(
  account: DataApiRewardAccount | null,
  profilePath: string,
): ProfileForCards['resolutionHistory'] {
  const stats = account?.rewardAccountStats
  if (!stats) {
    return undefined
  }
  const correctCount = Number(stats.correct)
  const incorrectCount = Number(stats.incorrect)
  if (!Number.isFinite(correctCount) || !Number.isFinite(incorrectCount) || correctCount + incorrectCount <= 0) {
    return undefined
  }

  return {
    correctCount,
    incorrectCount,
    href: `${profilePath}?tab=resolutions` as Route,
  }
}

async function fetchCommunityProfileForSlug(normalized: ReturnType<typeof normalizePublicProfileSlug>) {
  const { communityUrl: communityApiUrl } = resolvePublicRuntimeEnv(process.env)
  if (!communityApiUrl || normalized.type === 'invalid') {
    return null
  }

  try {
    return normalized.type === 'address'
      ? await fetchCommunityProfileByAddress({
          communityApiUrl,
          address: normalized.value,
          signal: AbortSignal.timeout(COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS),
        })
      : await fetchCommunityProfileByUsername({
          communityApiUrl,
          username: normalized.value,
          signal: AbortSignal.timeout(COMMUNITY_PROFILE_LOOKUP_TIMEOUT_MS),
        })
  } catch (error) {
    const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
    if (errorName !== 'AbortError' && errorName !== 'TimeoutError') {
      console.error('Failed to load community public profile', error)
    }
    return null
  }
}

function mapCommunityPublicProfile(profile: CommunityProfile | null) {
  if (!profile) {
    return null
  }

  const depositWalletAddress = profile.deposit_wallet_address?.trim()
  if (!depositWalletAddress) {
    return null
  }

  return {
    username: profile.username?.trim() || null,
    image: profile.avatar_url?.trim() || '',
    created_at: profile.created_at ?? null,
    deposit_wallet_address: depositWalletAddress,
  }
}

function resolvePublicProfileDisplayUsername(profile: {
  username?: string | null
  deposit_wallet_address?: string | null
}) {
  const username = profile.username?.trim()
  if (username) {
    return username
  }

  const depositWalletAddress = profile.deposit_wallet_address?.trim()
  return depositWalletAddress ? truncateAddress(depositWalletAddress) : 'Anon'
}

async function resolvePublicProfileForSlug(normalized: ReturnType<typeof normalizePublicProfileSlug>) {
  const communityProfile = mapCommunityPublicProfile(await fetchCommunityProfileForSlug(normalized))
  if (communityProfile || normalized.type === 'invalid') {
    return communityProfile
  }

  const { data: localProfile } = await UserRepository.getProfileByUsernameOrDepositWalletAddress(normalized.value)
  return localProfile
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
    normalized.type !== 'invalid' ? resolvePublicProfileForSlug(normalized) : Promise.resolve(null),
  ])
  const profile = profileResult
  const siteName = runtimeTheme.site.name

  const titleLabel = resolveProfileTitleLabel(slug, profile?.username ?? null)
  const canonicalSlug = resolveProfileCanonicalSlug(slug, profile?.username ?? null)
  const pageUrl = new URL(buildLocalizedPagePath(`/${canonicalSlug}`, locale), resolveSiteUrl(process.env)).toString()
  const imageUrl = buildPublicProfileOgImageUrl({
    locale,
    slug: canonicalSlug,
    version: resolveCommitSha(),
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

  const profile = await resolvePublicProfileForSlug(normalized)

  if (!profile) {
    if (normalized.type === 'username') {
      notFound()
    }

    const [snapshot, fallbackChartEndDate, resolutionAccount] = await Promise.all([
      fetchPortfolioSnapshot(normalized.value),
      buildFallbackChartEndDate(),
      loadPublicResolutionAccount(normalized.value),
    ])
    const profilePath = `/${resolveProfileCanonicalSlug(slug, null)}`

    return (
      <>
        <PublicProfileHeroCards
          profile={{
            username: 'Anon',
            avatarUrl: '',
            joinedAt: undefined,
            portfolioAddress: normalized.value,
            resolutionHistory: buildResolutionHistory(resolutionAccount, profilePath),
          }}
          snapshot={snapshot}
          fallbackChartEndDate={fallbackChartEndDate}
        />
        <PublicProfileTabsSection userAddress={normalized.value} resolutionAccount={resolutionAccount} />
      </>
    )
  }

  const userAddress = profile.deposit_wallet_address!
  const [snapshot, fallbackChartEndDate, resolutionAccount] = await Promise.all([
    fetchPortfolioSnapshot(userAddress),
    buildFallbackChartEndDate(),
    loadPublicResolutionAccount(userAddress),
  ])
  const profilePath = `/${resolveProfileCanonicalSlug(slug, profile.username)}`

  return (
    <>
      <PublicProfileHeroCards
        profile={{
          username: resolvePublicProfileDisplayUsername(profile),
          avatarUrl: profile.image,
          joinedAt: profile.created_at?.toString(),
          portfolioAddress: userAddress,
          resolutionHistory: buildResolutionHistory(resolutionAccount, profilePath),
        }}
        snapshot={snapshot}
        fallbackChartEndDate={fallbackChartEndDate}
      />
      <PublicProfileTabsSection userAddress={userAddress} resolutionAccount={resolutionAccount} />
    </>
  )
}
