'use client'

import type { Notification } from '@/types'
import { BellIcon, ExternalLinkIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getAvatarPlaceholderStyle } from '@/lib/avatar'
import {
  isLocalOrderFillNotification,
  useNotificationList,
  useNotifications,
  useNotificationsError,
  useNotificationsLoading,
  useUnreadNotificationCount,
} from '@/stores/useNotifications'

function getNotificationTimeLabel(notification: Notification) {
  if (notification.time_ago) {
    return notification.time_ago
  }

  const createdAt = new Date(notification.created_at)

  if (Number.isNaN(createdAt.getTime())) {
    return ''
  }

  const diffMs = Math.max(0, Date.now() - createdAt.getTime())
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

export default function HeaderNotifications() {
  const notifications = useNotificationList()
  const unreadCount = useUnreadNotificationCount()
  const setNotifications = useNotifications(state => state.setNotifications)
  const removeNotification = useNotifications(state => state.removeNotification)
  const isLoading = useNotificationsLoading()
  const error = useNotificationsError()
  const hasNotifications = notifications.length > 0

  useEffect(() => {
    queueMicrotask(() => setNotifications())
  }, [setNotifications])

  function handleLocalOrderFillClick(notification: Notification) {
    if (!isLocalOrderFillNotification(notification)) {
      return
    }

    if (notification.link_url) {
      window.open(notification.link_url, '_blank', 'noopener,noreferrer')
    }

    queueMicrotask(() => {
      void removeNotification(notification.id)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="headerIconCompact" variant="ghost" className="relative">
          <BellIcon className="size-[1.35rem]" />
          {unreadCount > 0 && (
            <span
              className={`
                absolute top-0.5 right-1.5 flex size-3 items-center justify-center rounded-full bg-primary text-xs
                font-medium text-destructive-foreground
              `}
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-100 w-85 overflow-hidden lg:w-95"
        align="end"
        collisionPadding={32}
      >
        <div className="border-b border-border px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        </div>

        <div className="max-h-100 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 animate-pulse opacity-50" />
              <p className="text-sm">Loading notifications...</p>
            </div>
          )}

          {error && !hasNotifications && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 opacity-50" />
              <p className="text-sm text-destructive">Failed to load notifications</p>
            </div>
          )}

          {!isLoading && !error && !hasNotifications && (
            <div className="p-4 text-center text-muted-foreground">
              <BellIcon className="mx-auto mb-2 size-8 opacity-50" />
              <p className="text-sm">You have no notifications.</p>
            </div>
          )}

          {!isLoading && hasNotifications && (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const timeLabel = getNotificationTimeLabel(notification)
                const hasLink = Boolean(notification.link_url)
                const linkIsExternal = notification.link_type === 'external'
                const isLocalOrderFill = isLocalOrderFillNotification(notification)
                const linkIcon = (
                  <ExternalLinkIcon
                    className={`size-3 text-muted-foreground ${hasLink ? '' : 'opacity-0'}`}
                  />
                )

                return (
                  <div
                    key={notification.id}
                    className={`
                      flex items-start gap-3 p-3 transition-colors hover:bg-accent/50
                      ${isLocalOrderFill ? 'cursor-pointer' : 'cursor-default'}
                    `}
                    role={isLocalOrderFill ? 'button' : undefined}
                    tabIndex={isLocalOrderFill ? 0 : undefined}
                    onClick={isLocalOrderFill ? () => handleLocalOrderFillClick(notification) : undefined}
                    onKeyDown={isLocalOrderFill
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleLocalOrderFillClick(notification)
                          }
                        }
                      : undefined}
                  >
                    <div className="shrink-0">
                      {(() => {
                        const avatarUrl = notification.user_avatar?.trim() ?? ''
                        if (avatarUrl) {
                          return (
                            <Image
                              src={avatarUrl}
                              alt="User avatar"
                              width={42}
                              height={42}
                              className="rounded-md object-cover"
                            />
                          )
                        }
                        return (
                          <div
                            aria-hidden="true"
                            className="size-10.5 rounded-md"
                            style={getAvatarPlaceholderStyle(notification.id || notification.title)}
                          />
                        )
                      })()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm/tight font-semibold text-foreground">
                            {notification.title}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-xs/tight text-muted-foreground">
                            {notification.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {timeLabel}
                          </span>
                          {hasLink && !isLocalOrderFill
                            ? (
                                <a
                                  href={notification.link_url ?? undefined}
                                  className="inline-flex"
                                  target={linkIsExternal ? '_blank' : undefined}
                                  rel={linkIsExternal ? 'noreferrer noopener' : undefined}
                                  aria-label={notification.link_label ?? 'View notification details'}
                                  onClick={event => event.stopPropagation()}
                                >
                                  {linkIcon}
                                </a>
                              )
                            : (
                                linkIcon
                              )}
                        </div>
                      </div>

                      {notification.extra_info && (
                        <div className="mt-1">
                          <p className="text-xs text-foreground">
                            {notification.extra_info}
                          </p>
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
