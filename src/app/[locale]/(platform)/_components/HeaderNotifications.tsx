'use client'

import type { Route } from 'next'
import type { TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from 'react'

import { BellIcon, ExternalLinkIcon, MergeIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { Notification } from '@/types'

import EventIconImage, { isEventMarketIconUrl } from '@/components/EventIconImage'
import {
  FollowedTradeAvatar,
  FollowedTradeMarketContext,
  FollowedTradeSummary,
} from '@/components/FollowedTradeNotification'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { getAvatarPlaceholderStyle } from '@/lib/avatar'
import { markTradeAlertsRead } from '@/lib/trade-alerts-idb'
import { cn } from '@/lib/utils'
import {
  isLocalOrderFillNotification,
  useNotificationList,
  useNotifications,
  useNotificationsError,
  useNotificationsLoading,
  useUnreadNotificationCount,
} from '@/stores/useNotifications'
import { useTradeAlertsStore } from '@/stores/useTradeAlerts'
import { useUser } from '@/stores/useUser'

const WHEEL_DELTA_LINE_MODE = 1
const WHEEL_DELTA_PAGE_MODE = 2
const FALLBACK_WHEEL_LINE_HEIGHT = 16

function getNotificationTimeLabel(notification: Notification, currentTimestamp: number | null) {
  if (notification.time_ago) {
    return notification.time_ago
  }

  const createdAt = new Date(notification.created_at)

  if (Number.isNaN(createdAt.getTime())) {
    return ''
  }

  if (currentTimestamp == null) {
    return ''
  }

  const diffMs = Math.max(0, currentTimestamp - createdAt.getTime())
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) {
    return 'now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`
  }

  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours < 24) {
    return `${diffHours}h`
  }

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays < 7) {
    return `${diffDays}d`
  }

  const diffWeeks = Math.floor(diffDays / 7)

  if (diffWeeks < 4) {
    return `${diffWeeks}w`
  }

  const diffMonths = Math.floor(diffDays / 30)

  if (diffMonths < 12) {
    return `${diffMonths}mo`
  }

  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears}y`
}

function isLikelyTransactionHashSnippet(value: string | null | undefined) {
  if (!value) {
    return false
  }

  return /^0x[a-fA-F0-9]{8,}$/.test(value.trim())
}

function isLocalMergeNotification(notification: Notification) {
  if (!isLocalOrderFillNotification(notification)) {
    return false
  }

  const metadata = notification.metadata as { action?: string } | undefined
  return metadata?.action === 'merge'
}

function isFollowedTradeNotification(notification: Notification) {
  return notification.metadata?.source === 'followed_trade'
}

function followedTradeDetails(notification: Notification) {
  if (!isFollowedTradeNotification(notification)) {
    return null
  }
  const metadata = notification.metadata ?? {}
  const trader = typeof metadata.trader === 'string' ? metadata.trader : ''
  const side = typeof metadata.side === 'string' ? metadata.side : ''
  const outcome = typeof metadata.outcome === 'string' ? metadata.outcome : ''
  if (!trader || !side || !outcome) {
    return null
  }
  return {
    trader,
    side,
    outcome,
    followedWallet: typeof metadata.followedWallet === 'string' ? metadata.followedWallet : trader,
    averagePrice: typeof metadata.averagePrice === 'number' ? metadata.averagePrice : null,
    totalValue: typeof metadata.totalValue === 'number' ? metadata.totalValue : null,
    eventTitle:
      typeof metadata.eventTitle === 'string' && metadata.eventTitle.trim()
        ? metadata.eventTitle
        : notification.description,
    eventIcon: typeof metadata.eventIcon === 'string' ? metadata.eventIcon : null,
  }
}

function getWheelLineHeight(element: HTMLElement) {
  const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight)

  if (Number.isFinite(lineHeight)) {
    return lineHeight
  }

  return FALLBACK_WHEEL_LINE_HEIGHT
}

function getWheelDeltaYInPixels(event: ReactWheelEvent<HTMLDivElement>, element: HTMLElement) {
  if (event.deltaMode === WHEEL_DELTA_LINE_MODE) {
    return event.deltaY * getWheelLineHeight(element)
  }

  if (event.deltaMode === WHEEL_DELTA_PAGE_MODE) {
    return event.deltaY * element.clientHeight
  }

  return event.deltaY
}

function useLoadNotificationsOnMount() {
  const setNotifications = useNotifications((state) => state.setNotifications)

  useEffect(
    function loadNotificationsOnMount() {
      void setNotifications()
    },
    [setNotifications],
  )
}

export default function HeaderNotifications() {
  const t = useExtracted()
  const router = useRouter()
  const notificationsListRef = useRef<HTMLDivElement>(null)
  const previousTouchYRef = useRef<number | null>(null)
  const notifications = useNotificationList()
  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const unreadCount = useUnreadNotificationCount()
  const removeNotification = useNotifications((state) => state.removeNotification)
  const isLoading = useNotificationsLoading()
  const error = useNotificationsError()
  const user = useUser()
  const profileId = useTradeAlertsStore((state) => state.profileId)
  const hasNotifications = notifications.length > 0

  useLoadNotificationsOnMount()

  function handleBellOpenChange(open: boolean) {
    if (!open || !profileId || !user) {
      return
    }
    useTradeAlertsStore.getState().markAllRead()
    void markTradeAlertsRead(window.location.origin, profileId)
  }

  function scrollNotificationsList(deltaY: number) {
    const notificationsList = notificationsListRef.current

    if (!notificationsList || deltaY === 0) {
      return
    }

    notificationsList.scrollTop += deltaY
  }

  function handleNotificationsWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const notificationsList = notificationsListRef.current

    if (!notificationsList) {
      return
    }

    event.stopPropagation()

    if (event.cancelable) {
      event.preventDefault()
    }

    scrollNotificationsList(getWheelDeltaYInPixels(event, notificationsList))
  }

  function handleNotificationsTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    previousTouchYRef.current = event.touches[0]?.clientY ?? null
  }

  function handleNotificationsTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    event.stopPropagation()

    const touchY = event.touches[0]?.clientY ?? null
    const previousTouchY = previousTouchYRef.current
    previousTouchYRef.current = touchY

    if (touchY == null || previousTouchY == null) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    scrollNotificationsList(previousTouchY - touchY)
  }

  function handleNotificationsTouchEnd() {
    previousTouchYRef.current = null
  }

  function handleLocalTradeClick(notification: Notification) {
    if (!isLocalOrderFillNotification(notification) && !isFollowedTradeNotification(notification)) {
      return
    }

    const eventPath = notification.link_target?.trim()

    if (eventPath) {
      router.push(eventPath as Route)
    } else if (notification.link_url) {
      window.open(notification.link_url, '_blank', 'noopener,noreferrer')
    }

    if (isLocalOrderFillNotification(notification)) {
      void removeNotification(notification.id)
    }
  }

  return (
    <DropdownMenu modal={false} onOpenChange={handleBellOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button type="button" size="icon" variant="ghost" className="relative" aria-label={t('Notifications')} />
        }
      >
        <BellIcon className="size-[1.35rem]" />
        {unreadCount > 0 && (
          <span
            className={cn(
              `absolute top-0.5 right-1.5 flex size-3 items-center justify-center rounded-full bg-primary text-xs font-medium text-destructive-foreground`,
            )}
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-100 w-85 overflow-hidden lg:w-95"
        align="end"
        collisionPadding={32}
        data-sports-wheel-ignore="true"
        onWheelCapture={handleNotificationsWheel}
        onTouchStartCapture={handleNotificationsTouchStart}
        onTouchMoveCapture={handleNotificationsTouchMove}
        onTouchEndCapture={handleNotificationsTouchEnd}
        onTouchCancelCapture={handleNotificationsTouchEnd}
      >
        <div className="border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground">{t('Notifications')}</h3>
        </div>

        <div
          ref={notificationsListRef}
          className="max-h-[calc(min(25rem,var(--available-height))-2.75rem)] overflow-y-auto overscroll-contain"
        >
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 animate-pulse opacity-50" />
              <p className="text-sm">{t('Loading notifications...')}</p>
            </div>
          )}

          {error && !hasNotifications && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 opacity-50" />
              <p className="text-sm text-destructive">{t('Failed to load notifications')}</p>
            </div>
          )}

          {!isLoading && !error && !hasNotifications && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 opacity-50" />
              <p className="text-sm">{t('You have no notifications.')}</p>
            </div>
          )}

          {!isLoading && hasNotifications && (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const timeLabel = getNotificationTimeLabel(notification, currentTimestamp)
                const hasLink = Boolean(notification.link_url)
                const isFollowedTrade = isFollowedTradeNotification(notification)
                const followedTrade = followedTradeDetails(notification)
                const isLocalOrderFill = isLocalOrderFillNotification(notification) || isFollowedTrade
                const isLocalMerge = isLocalMergeNotification(notification)
                const linkIsExternal =
                  notification.link_type === 'external' || isLocalOrderFillNotification(notification)
                const extraInfo = notification.extra_info?.trim()
                const shouldShowExtraInfo = Boolean(extraInfo) && !isLikelyTransactionHashSnippet(extraInfo)
                const linkIcon = (
                  <ExternalLinkIcon className={cn('size-3 text-muted-foreground', { 'opacity-0': !hasLink })} />
                )
                const avatarUrl = notification.user_avatar?.trim() ?? ''
                const avatarContent = followedTrade ? (
                  <FollowedTradeAvatar
                    trader={followedTrade.trader}
                    wallet={followedTrade.followedWallet}
                    src={avatarUrl}
                  />
                ) : isFollowedTrade ? (
                  <FollowedTradeAvatar
                    trader={notification.title}
                    wallet={
                      typeof notification.metadata?.followedWallet === 'string'
                        ? notification.metadata.followedWallet
                        : notification.id
                    }
                    src={avatarUrl}
                  />
                ) : isLocalMerge ? (
                  <div
                    aria-hidden="true"
                    className={cn(
                      `flex size-10.5 items-center justify-center rounded-md bg-muted text-muted-foreground`,
                    )}
                  >
                    <MergeIcon className="size-4 rotate-90" />
                  </div>
                ) : avatarUrl ? (
                  isEventMarketIconUrl(avatarUrl) ? (
                    <EventIconImage
                      src={avatarUrl}
                      alt="User avatar"
                      sizes="42px"
                      containerClassName="size-10.5 rounded-md"
                    />
                  ) : (
                    <Image
                      src={avatarUrl}
                      alt="User avatar"
                      width={42}
                      height={42}
                      className="size-10.5 rounded-md object-cover"
                    />
                  )
                ) : (
                  <div
                    aria-hidden="true"
                    className="size-10.5 rounded-md"
                    style={getAvatarPlaceholderStyle(notification.id || notification.title)}
                  />
                )

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      `flex items-start gap-3 p-3 transition-colors hover:bg-accent/50 ${isLocalOrderFill ? 'cursor-pointer' : 'cursor-default'}`,
                    )}
                    role={isLocalOrderFill ? 'button' : undefined}
                    tabIndex={isLocalOrderFill ? 0 : undefined}
                    onClick={isLocalOrderFill ? () => handleLocalTradeClick(notification) : undefined}
                    onKeyDown={
                      isLocalOrderFill
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              handleLocalTradeClick(notification)
                            }
                          }
                        : undefined
                    }
                  >
                    <div className="shrink-0">{avatarContent}</div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {followedTrade ? (
                            <>
                              <FollowedTradeSummary
                                trader={followedTrade.trader}
                                side={followedTrade.side}
                                outcome={followedTrade.outcome}
                                averagePrice={followedTrade.averagePrice}
                                totalValue={followedTrade.totalValue}
                                className="block pr-1"
                              />
                              <FollowedTradeMarketContext
                                eventTitle={followedTrade.eventTitle}
                                eventIcon={followedTrade.eventIcon}
                                className="mt-1"
                              />
                            </>
                          ) : (
                            <>
                              <h4 className="text-sm/tight font-semibold text-foreground">{notification.title}</h4>
                              <p className="mt-1 line-clamp-2 text-xs/tight text-muted-foreground">
                                {notification.description}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-muted-foreground">{timeLabel}</span>
                          {hasLink ? (
                            <a
                              href={notification.link_url ?? undefined}
                              className="inline-flex"
                              target={linkIsExternal ? '_blank' : undefined}
                              rel={linkIsExternal ? 'noreferrer noopener' : undefined}
                              aria-label={notification.link_label ?? t('View notification details')}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {linkIcon}
                            </a>
                          ) : (
                            linkIcon
                          )}
                        </div>
                      </div>

                      {shouldShowExtraInfo && extraInfo && (
                        <div className="mt-1">
                          <p className="text-xs text-foreground">{extraInfo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
