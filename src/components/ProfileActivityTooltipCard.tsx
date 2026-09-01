'use client'

import { useExtracted, useLocale } from 'next-intl'
import Image from 'next/image'

import type { ProfileLinkStats } from '@/lib/data-api/profile-link-stats'

import CommunityFollowButton from '@/components/CommunityFollowButton'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface ProfileActivityTooltipCardProps {
  profile: {
    username: string
    avatarUrl?: string | null
    avatarSeed?: string | null
    href: string
    joinedAt?: string | null
    tradingWallet?: string | null
  }
  stats: ProfileLinkStats | null
  isLoading?: boolean
}

function formatJoinedDate(joinedAt: string | null | undefined, locale: string) {
  if (!joinedAt) {
    return null
  }

  const parsed = new Date(joinedAt)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function normalizeStatValue(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatStatValue(value?: number | string | null) {
  const resolvedValue = normalizeStatValue(value)
  if (resolvedValue == null) {
    return '-'
  }

  const absValue = Math.abs(resolvedValue)
  const million = 1_000_000
  const thousand = 1_000

  if (absValue >= million) {
    const scaled = absValue / million
    const formatted = scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/, '')
    return `$${formatted}m`
  }

  if (absValue >= thousand) {
    const scaled = absValue / thousand
    const formatted = scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/, '')
    return `$${formatted}k`
  }

  if (absValue > 0 && absValue < 1) {
    return `$${absValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
  }

  return `$${Math.round(absValue)}`
}

function formatSignedStatValue(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  const absoluteValue = Math.abs(value)
  const formattedValue =
    absoluteValue >= 1_000
      ? formatStatValue(absoluteValue)
      : `$${absoluteValue
          .toFixed(2)
          .replace(/\.00$/, '')
          .replace(/(\.\d)0$/, '$1')}`

  if (value < 0) {
    return `-${formattedValue}`
  }

  if (value > 0) {
    return `+${formattedValue}`
  }

  return formattedValue
}

export default function ProfileActivityTooltipCard({
  profile,
  stats,
  isLoading = false,
}: ProfileActivityTooltipCardProps) {
  const t = useExtracted()
  const locale = useLocale()
  const profileHref = profile.href as any
  const joinedDate = formatJoinedDate(profile.joinedAt, locale)
  const joinedLabel = joinedDate ? t('Joined {date}', { date: joinedDate }) : null
  const positionsValue = formatStatValue(stats?.positionsValue)
  const volumeValue = formatStatValue(stats?.volume)
  const profitLossNumber =
    typeof stats?.profitLoss === 'number' && Number.isFinite(stats.profitLoss) ? stats.profitLoss : null
  const profitLossValue = formatSignedStatValue(profitLossNumber)
  const profitLossClassName =
    profitLossNumber == null
      ? 'text-foreground'
      : profitLossNumber > 0
        ? 'text-yes'
        : profitLossNumber < 0
          ? 'text-no'
          : 'text-foreground'
  const avatarUrl = profile.avatarUrl?.trim() ?? ''
  const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
  const avatarSeed = profile.avatarSeed?.trim() || profile.username
  const fallbackStyle = showPlaceholder ? getAvatarPlaceholderStyle(avatarSeed) : undefined

  return (
    <div className="w-64 rounded-lg border bg-secondary pb-3">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
          {showPlaceholder ? (
            <div aria-hidden="true" className="absolute inset-0 rounded-full" style={fallbackStyle} />
          ) : (
            <Image
              src={avatarUrl}
              alt={t('{username} avatar', { username: profile.username })}
              fill
              sizes="56px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <Link
            href={profileHref}
            className={cn(
              `block truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-foreground`,
            )}
            title={profile.username}
          >
            {profile.username}
          </Link>
          {joinedLabel && <div className="text-left text-xs text-muted-foreground">{joinedLabel}</div>}
        </div>
        <CommunityFollowButton wallet={profile.tradingWallet} variant="icon" className="size-9 rounded-full" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {isLoading ? (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-1">
                <Skeleton className="mx-auto h-4 w-14" />
                <Skeleton className="mx-auto h-3 w-16" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground tabular-nums">{positionsValue}</div>
              <div className="text-xs font-medium text-muted-foreground">{t('Positions')}</div>
            </div>
            <div className="space-y-1">
              <div className={cn('text-sm font-semibold tabular-nums', profitLossClassName)}>{profitLossValue}</div>
              <div className="text-xs font-medium text-muted-foreground">{t('Profit/loss')}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground tabular-nums">{volumeValue}</div>
              <div className="text-xs font-medium text-muted-foreground">{t('Volume')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
