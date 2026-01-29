'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProfileActivityTooltipCard from '@/components/ProfileActivityTooltipCard'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fetchProfileLinkStats } from '@/lib/data-api/profile-link-stats'
import { formatTimeAgo, truncateAddress } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface ProfileLinkProps {
  user: {
    address: string
    proxy_wallet_address?: string | null
    image: string
    username: string
  }
  profileSlug?: string
  layout?: 'default' | 'inline'
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
}: ProfileLinkProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchProfileLinkStats>>>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const isInline = layout === 'inline'
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
  const addressSlug = user.proxy_wallet_address ?? user.address ?? ''
  const displayUsername = normalizedUsername || (addressSlug ? truncateAddress(addressSlug) : 'Anonymous')
  const titleValue = normalizedUsername || addressSlug || displayUsername
  const resolvedProfileSlug = profileSlug ?? (normalizedUsername || addressSlug)
  const profileHref = resolvedProfileSlug ? (`/@${resolvedProfileSlug}` as any) : ('#' as any)
  const avatarSeed = addressSlug || resolvedProfileSlug || 'user'
  const avatarSrc = user.image && user.image.trim()
    ? user.image
    : `https://avatar.vercel.sh/${avatarSeed}.png`
  const statsAddress = useMemo(
    () => user.proxy_wallet_address ?? user.address,
    [user.address, user.proxy_wallet_address],
  )

  useEffect(() => {
    setStats(null)
    setHasLoaded(false)
  }, [statsAddress])

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return
    }

    if (!statsAddress) {
      setHasLoaded(true)
      return
    }

    const controller = new AbortController()
    let isActive = true

    fetchProfileLinkStats(statsAddress, controller.signal)
      .then((result) => {
        if (!isActive || controller.signal.aborted) {
          return
        }
        setStats(result)
        setHasLoaded(true)
      })
      .catch((error) => {
        if (!isActive || controller.signal.aborted || error?.name === 'AbortError') {
          return
        }
        setStats(null)
        setHasLoaded(true)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [hasLoaded, isOpen, statsAddress])

  const isTooltipLoading = isOpen && !hasLoaded

  const dateLabel = date
    ? (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {formatTimeAgo(date)}
        </span>
      )
    : null

  const triggerContent = (
    <div className="inline-flex min-w-0 items-center gap-3">
      <Link href={profileHref} className="relative shrink-0">
        <Image
          src={avatarSrc}
          alt={displayUsername}
          width={32}
          height={32}
          className="aspect-square rounded-full object-cover object-center"
        />
        {position && (
          <Badge
            variant="secondary"
            style={{ backgroundColor: medalColor, color: medalTextColor }}
            className="absolute top-0 -right-2 size-5 rounded-full px-1 font-mono text-muted-foreground tabular-nums"
          >
            {position}
          </Badge>
        )}
      </Link>
      <div className={usernameWrapperClassName}>
        <Link
          href={profileHref}
          title={titleValue}
          className={usernameLinkClassName}
        >
          {displayUsername}
        </Link>
      </div>
    </div>
  )

  return (
    <Tooltip onOpenChange={setIsOpen}>
      <div
        className={cn(
          'flex gap-3',
          isInline ? 'items-center justify-between' : children ? 'items-start' : 'items-center',
          isInline ? null : 'py-2',
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
            : (
                <div className="flex min-w-0 items-center gap-1">
                  <TooltipTrigger asChild>
                    {triggerContent}
                  </TooltipTrigger>
                  {usernameAddon ? <span className="shrink-0">{usernameAddon}</span> : null}
                  {dateLabel}
                </div>
              )}
          {!isInline && children
            ? <div className="pl-13">{children}</div>
            : null}
        </div>
        {!isInline && trailing
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
            avatarUrl: avatarSrc,
            href: profileHref,
            joinedAt,
          }}
          stats={stats}
          isLoading={isTooltipLoading}
        />
      </TooltipContent>
    </Tooltip>
  )
}
