'use client'

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import AppLink from '@/components/AppLink'
import ProfileActivityTooltipCard from '@/components/ProfileActivityTooltipCard'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getAvatarPlaceholderStyle,
  shouldUseAvatarPlaceholder,
} from '@/lib/avatar'
import { fetchProfileLinkStats } from '@/lib/data-api/profile-link-stats'
import { formatTimeAgo, truncateAddress } from '@/lib/formatters'
import { buildPublicProfilePath } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

interface ProfileLinkProps {
  user: {
    address: string
    deposit_wallet_address?: string | null
    image: string
    username: string
  }
  profileSlug?: string
  profileHref?: string
  layout?: 'default' | 'inline' | 'stacked'
  avatarSize?: number
  avatarBadge?: ReactNode
  tooltipTrigger?: 'all' | 'avatar-username'
  position?: number
  date?: string
  children?: ReactNode
  inlineContent?: ReactNode
  trailing?: ReactNode
  containerClassName?: string
  usernameMaxWidthClassName?: string
  usernameClassName?: string
  usernameAddon?: ReactNode
  joinedAt?: string | null
}

function useAvatarFallbackStyle(showPlaceholder: boolean, avatarSeed: string) {
  return useMemo<CSSProperties | undefined>(() => {
    if (!showPlaceholder) {
      return undefined
    }

    return getAvatarPlaceholderStyle(avatarSeed)
  }, [avatarSeed, showPlaceholder])
}

function useProfileTooltipStats(user: ProfileLinkProps['user']) {
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchProfileLinkStats>>>(null)
  const [loadedStatsAddress, setLoadedStatsAddress] = useState<string | null>(null)
  const statsAddress = useMemo(
    () => user.deposit_wallet_address ?? user.address,
    [user.address, user.deposit_wallet_address],
  )
  const normalizedStatsAddress = statsAddress ?? null
  const hasLoaded = normalizedStatsAddress === null || loadedStatsAddress === normalizedStatsAddress
  const tooltipStats = loadedStatsAddress === normalizedStatsAddress ? stats : null

  useEffect(function fetchStatsOnTooltipOpen() {
    if (!isOpen || hasLoaded) {
      return
    }

    if (!normalizedStatsAddress) {
      return
    }

    const controller = new AbortController()
    let isActive = true

    fetchProfileLinkStats(normalizedStatsAddress, controller.signal)
      .then((result) => {
        if (!isActive || controller.signal.aborted) {
          return
        }
        setStats(result)
        setLoadedStatsAddress(normalizedStatsAddress)
      })
      .catch((error) => {
        if (!isActive || controller.signal.aborted || error?.name === 'AbortError') {
          return
        }
        setStats(null)
        setLoadedStatsAddress(normalizedStatsAddress)
      })

    return function cleanupStatsFetch() {
      isActive = false
      controller.abort()
    }
  }, [hasLoaded, isOpen, normalizedStatsAddress])

  const isTooltipLoading = isOpen && !hasLoaded

  return { isOpen, setIsOpen, tooltipStats, isTooltipLoading }
}

export default function ProfileLink({
  user,
  layout = 'default',
  position,
  date,
  children,
  inlineContent,
  trailing,
  containerClassName,
  usernameMaxWidthClassName,
  usernameClassName,
  usernameAddon,
  joinedAt,
  profileSlug,
  profileHref: profileHrefOverride,
  avatarSize,
  avatarBadge,
  tooltipTrigger = 'all',
}: ProfileLinkProps) {
  const { setIsOpen, tooltipStats, isTooltipLoading } = useProfileTooltipStats(user)
  const isInline = layout === 'inline'
  const isStacked = layout === 'stacked'
  const inlineBody = inlineContent ?? children
  const inlineRowClassName = `
    flex min-w-0 flex-wrap items-center gap-1 text-foreground
  `
  const resolvedUsernameMaxWidth = usernameMaxWidthClassName
    ?? (isInline ? 'max-w-40 sm:max-w-56 lg:max-w-72' : 'max-w-32 lg:max-w-64')
  const usernameLinkClassName = cn(
    isInline ? 'block truncate text-sm font-medium' : 'block truncate text-sm font-medium',
    usernameClassName,
  )
  const usernameWrapperClassName = cn('min-w-0', resolvedUsernameMaxWidth)

  const medalColor = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32',
  }[position ?? 0] ?? '#000000'

  const medalTextColor = medalColor === '#000000' ? '#ffffff' : '#1a1a1a'
  const normalizedUsername = user.username.trim()
  const addressSlug = user.deposit_wallet_address ?? user.address ?? ''
  const displayUsername = normalizedUsername || (addressSlug ? truncateAddress(addressSlug) : 'Anonymous')
  const titleValue = normalizedUsername || addressSlug || displayUsername
  const resolvedProfileSlug = profileSlug ?? (normalizedUsername || addressSlug)
  const profileHref = profileHrefOverride
    ? (profileHrefOverride as any)
    : (resolvedProfileSlug ? ((buildPublicProfilePath(resolvedProfileSlug) ?? '#') as any) : ('#' as any))
  const rawAvatarUrl = user.image?.trim() ?? ''
  const avatarSeed = addressSlug || resolvedProfileSlug || 'user'
  const hasCustomAvatar = Boolean(rawAvatarUrl)
  const resolvedAvatarSize = avatarSize ?? 32
  const showPlaceholder = shouldUseAvatarPlaceholder(rawAvatarUrl)
  const tooltipAvatarUrl = showPlaceholder
    ? null
    : rawAvatarUrl
  const fallbackStyle = useAvatarFallbackStyle(showPlaceholder, avatarSeed)

  const dateLabel = date
    ? (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {formatTimeAgo(date)}
        </span>
      )
    : null

  const avatarNode = (
    <AppLink href={profileHref} data-avatar-wrapper="true" className="relative isolate shrink-0">
      {!showPlaceholder && hasCustomAvatar
        ? (
            <Image
              src={rawAvatarUrl}
              alt={displayUsername}
              width={resolvedAvatarSize}
              height={resolvedAvatarSize}
              data-avatar="true"
              className="aspect-square rounded-full border border-border/80 object-cover object-center"
            />
          )
        : (
            <div
              aria-hidden="true"
              data-avatar="true"
              className="aspect-square rounded-full border border-border/80"
              style={{ ...fallbackStyle, width: resolvedAvatarSize, height: resolvedAvatarSize }}
            />
          )}
      {avatarBadge}
      {position && (
        <Badge
          variant="secondary"
          style={{ backgroundColor: medalColor, color: medalTextColor }}
          className="absolute top-0 -right-2 size-5 rounded-full px-1 font-mono text-muted-foreground tabular-nums"
        >
          {position}
        </Badge>
      )}
    </AppLink>
  )

  const usernameNode = (
    <div className={usernameWrapperClassName}>
      <AppLink
        href={profileHref}
        title={titleValue}
        className={usernameLinkClassName}
      >
        {displayUsername}
      </AppLink>
    </div>
  )

  const triggerContent = (
    <div className="inline-flex min-w-0 items-center gap-3">
      {avatarNode}
      {usernameNode}
    </div>
  )

  const stackedHeaderAddon = usernameAddon ? <span className="shrink-0">{usernameAddon}</span> : null
  const stackedHeader = (
    <div className="flex min-w-0 items-center gap-2">
      {usernameNode}
      {stackedHeaderAddon}
    </div>
  )

  return (
    <Tooltip onOpenChange={setIsOpen}>
      <div
        className={cn(
          'flex gap-3',
          isInline
            ? 'items-center justify-between'
            : isStacked
              ? 'items-center'
              : children
                ? 'items-start'
                : `items-center`,
          { 'py-2': !(isInline || isStacked) },
          containerClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          {isInline
            ? (
                <div className="flex min-w-0 items-start gap-2">
                  <div className={inlineRowClassName}>
                    <TooltipTrigger asChild>
                      {triggerContent}
                    </TooltipTrigger>
                    {usernameAddon ? <span className="shrink-0">{usernameAddon}</span> : null}
                    {inlineBody ?? null}
                  </div>
                  {dateLabel || trailing
                    ? (
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          {dateLabel}
                          {trailing}
                        </div>
                      )
                    : null}
                </div>
              )
            : isStacked
              ? (
                  <div className="flex min-w-0 items-center gap-3">
                    {tooltipTrigger === 'avatar-username'
                      ? (
                          <>
                            <TooltipTrigger asChild>
                              {avatarNode}
                            </TooltipTrigger>
                            <div className="flex min-w-0 flex-col gap-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <TooltipTrigger asChild>
                                  {usernameNode}
                                </TooltipTrigger>
                                {stackedHeaderAddon}
                              </div>
                              {children ?? null}
                            </div>
                          </>
                        )
                      : (
                          <TooltipTrigger asChild>
                            <div className="flex min-w-0 items-center gap-3">
                              {avatarNode}
                              <div className="flex min-w-0 flex-col gap-1">
                                {stackedHeader}
                                {children ?? null}
                              </div>
                            </div>
                          </TooltipTrigger>
                        )}
                  </div>
                )
              : (
                  <div className="flex min-w-0 items-center gap-1">
                    <TooltipTrigger asChild>
                      {triggerContent}
                    </TooltipTrigger>
                    {usernameAddon ? <span className="shrink-0">{usernameAddon}</span> : null}
                    {dateLabel}
                  </div>
                )}
          {!isInline && !isStacked && children
            ? <div className="pl-13">{children}</div>
            : null}
        </div>
        {!isInline && !isStacked && trailing
          ? (
              <div className="ml-2 flex shrink-0 items-center text-right">
                {trailing}
              </div>
            )
          : null}
      </div>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-[90vw] border-none bg-transparent p-0 text-popover-foreground shadow-none md:max-w-96"
      >
        <ProfileActivityTooltipCard
          profile={{
            username: displayUsername,
            avatarUrl: tooltipAvatarUrl,
            avatarSeed,
            href: profileHref,
            joinedAt,
          }}
          stats={tooltipStats}
          isLoading={isTooltipLoading}
        />
      </TooltipContent>
    </Tooltip>
  )
}
