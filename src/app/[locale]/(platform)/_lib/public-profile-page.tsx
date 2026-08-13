import type { Metadata, Route } from 'next'

import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

import type { SupportedLocale } from '@/i18n/locales'
import type { CommunityProfile } from '@/lib/community-profile'
import type { DataApiRewardAccount } from '@/lib/data-api/resolution-rewards'

import PublicProfileHeroCards from '@/app/[locale]/(platform)/profile/_components/PublicProfileHeroCards'
import PublicProfileResolutionHistory from '@/app/[locale]/(platform)/profile/_components/PublicProfileResolutionHistory'
import PublicProfileTabs from '@/app/[locale]/(platform)/profile/_components/PublicProfileTabs'
import PublicResolutionsList from '@/app/[locale]/(platform)/profile/_components/PublicResolutionsList'
import CommunityFollowButton from '@/components/CommunityFollowButton'
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
import { parseResolutionHistoryCount } from '@/lib/resolution-reward-history'
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

async function PublicProfileResolutionsContent({
  resolutionAccountPromise,
}: {
  resolutionAccountPromise: Promise<DataApiRewardAccount | null>
}) {
  const resolutionAccount = await resolutionAccountPromise

  return <PublicResolutionsList resolutionAccount={resolutionAccount} />
}

function PublicProfileTabsSection({
  userAddress,
  resolutionAccountPromise,
}: {
  userAddress: string
  resolutionAccountPromise: Promise<DataApiRewardAccount | null>
}) {
  return (
    <Suspense fallback={<PublicProfileTabsFallback />}>
      <PublicProfileTabs
        userAddress={userAddress}
        resolutionsContent={
          <Suspense
            fallback={
              <div className="space-y-3 px-3 pb-4" aria-busy="true">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            }
          >
            <PublicProfileResolutionsContent resolutionAccountPromise={resolutionAccountPromise} />
          </Suspense>
        }
      />
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

function buildResolutionHistory(account: DataApiRewardAccount | null, profilePath: string) {
  const stats = account?.rewardAccountStats
  if (!stats) {
    return undefined
  }
  const correctCount = parseResolutionHistoryCount(stats.correct)
  const incorrectCount = parseResolutionHistoryCount(stats.incorrect)
  if (correctCount == null || incorrectCount == null || correctCount + incorrectCount <= 0) {
    return undefined
  }

  return {
    correctCount,
    incorrectCount,
    href: `${profilePath}?tab=resolutions` as Route,
  }
}

async function PublicProfileResolutionHistorySlot({
  resolutionAccountPromise,
  profilePath,
  username,
}: {
  resolutionAccountPromise: Promise<DataApiRewardAccount | null>
  profilePath: string
  username: string
}) {
  const resolutionHistory = buildResolutionHistory(await resolutionAccountPromise, profilePath)
  if (!resolutionHistory) {
    return null
  }

  return <PublicProfileResolutionHistory username={username} {...resolutionHistory} />
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

    const resolutionAccountPromise = loadPublicResolutionAccount(normalized.value)
    const [snapshot, fallbackChartEndDate] = await Promise.all([
      fetchPortfolioSnapshot(normalized.value),
      buildFallbackChartEndDate(),
    ])
    const profilePath = `/${resolveProfileCanonicalSlug(slug, null)}`
    const username = 'Anon'

    return (
      <>
        <PublicProfileHeroCards
          profile={{
            username,
            avatarUrl: '',
            joinedAt: undefined,
            portfolioAddress: normalized.value,
          }}
          snapshot={snapshot}
          fallbackChartEndDate={fallbackChartEndDate}
          headerActions={<CommunityFollowButton wallet={normalized.value} />}
          resolutionHistoryAdornment={
            <Suspense fallback={null}>
              <PublicProfileResolutionHistorySlot
                resolutionAccountPromise={resolutionAccountPromise}
                profilePath={profilePath}
                username={username}
              />
            </Suspense>
          }
        />
        <PublicProfileTabsSection userAddress={normalized.value} resolutionAccountPromise={resolutionAccountPromise} />
      </>
    )
  }

  const userAddress = profile.deposit_wallet_address!
  const resolutionAccountPromise = loadPublicResolutionAccount(userAddress)
  const [snapshot, fallbackChartEndDate] = await Promise.all([
    fetchPortfolioSnapshot(userAddress),
    buildFallbackChartEndDate(),
  ])
  const profilePath = `/${resolveProfileCanonicalSlug(slug, profile.username)}`
  const username = resolvePublicProfileDisplayUsername(profile)

  return (
    <>
      <PublicProfileHeroCards
        profile={{
          username,
          avatarUrl: profile.image,
          joinedAt: profile.created_at?.toString(),
          portfolioAddress: userAddress,
        }}
        snapshot={snapshot}
        fallbackChartEndDate={fallbackChartEndDate}
        headerActions={<CommunityFollowButton wallet={userAddress} />}
        resolutionHistoryAdornment={
          <Suspense fallback={null}>
            <PublicProfileResolutionHistorySlot
              resolutionAccountPromise={resolutionAccountPromise}
              profilePath={profilePath}
              username={username}
            />
          </Suspense>
        }
      />
      <PublicProfileTabsSection userAddress={userAddress} resolutionAccountPromise={resolutionAccountPromise} />
    </>
  )
}
