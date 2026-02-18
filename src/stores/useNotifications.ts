import type { Notification } from '@/types'
import { create } from 'zustand'

import { POLYGON_SCAN_BASE } from '@/lib/network'

const LOCAL_ORDER_FILL_STORAGE_KEY = 'header-local-order-fill-notifications-v1'
const LOCAL_ORDER_FILL_NOTIFICATION_SOURCE = 'local_order_fill'
const LOCAL_ORDER_FILL_NOTIFICATION_PREFIX = 'local-order-fill-'
const LOCAL_ORDER_FILL_AVATAR = '/images/withdraw/chain/polygon.svg'

interface LocalOrderFillMetadata {
  source: typeof LOCAL_ORDER_FILL_NOTIFICATION_SOURCE
  txHash: string
  action: 'split' | 'merge'
}

interface LocalOrderFillNotificationInput {
  action: 'split' | 'merge'
  txHash: string
  title: string
  description: string
  marketIconUrl?: string | null
}

interface NotificationsState {
  notifications: Notification[]
  setNotifications: () => Promise<void>
  addNotification: (notification: Notification) => void
  addLocalOrderFillNotification: (payload: LocalOrderFillNotificationInput) => void
  removeNotification: (notificationId: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

function isClientSide() {
  return typeof window !== 'undefined'
}

function isLikelyTxHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash)
}

function isAllowedAvatarUrl(value: string) {
  return value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('/')
}

function sortNotificationsByCreatedAtDesc(notifications: Notification[]) {
  return [...notifications].sort((first, second) => {
    const firstTime = Date.parse(first.created_at)
    const secondTime = Date.parse(second.created_at)

    const normalizedFirst = Number.isFinite(firstTime) ? firstTime : 0
    const normalizedSecond = Number.isFinite(secondTime) ? secondTime : 0
    return normalizedSecond - normalizedFirst
  })
}

function dedupeNotificationsById(notifications: Notification[]) {
  const map = new Map<string, Notification>()
  notifications.forEach((notification) => {
    map.set(notification.id, notification)
  })
  return Array.from(map.values())
}

function normalizeStoredLocalNotifications(raw: unknown): Notification[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((entry) => {
    if (
      typeof entry !== 'object'
      || entry === null
      || typeof (entry as Notification).id !== 'string'
      || typeof (entry as Notification).title !== 'string'
      || typeof (entry as Notification).description !== 'string'
      || typeof (entry as Notification).created_at !== 'string'
    ) {
      return []
    }

    const notification = entry as Notification
    if (!isLocalOrderFillNotification(notification)) {
      return [notification]
    }

    return [
      {
        ...notification,
        user_avatar: notification.user_avatar?.trim() || LOCAL_ORDER_FILL_AVATAR,
      },
    ]
  })
}

function readLocalOrderFillNotifications(): Notification[] {
  if (!isClientSide()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_ORDER_FILL_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return sortNotificationsByCreatedAtDesc(normalizeStoredLocalNotifications(parsed))
  }
  catch {
    return []
  }
}

function writeLocalOrderFillNotifications(notifications: Notification[]) {
  if (!isClientSide()) {
    return
  }

  try {
    window.localStorage.setItem(
      LOCAL_ORDER_FILL_STORAGE_KEY,
      JSON.stringify(sortNotificationsByCreatedAtDesc(notifications).slice(0, 50)),
    )
  }
  catch {
    // Ignore local storage write failures to avoid blocking UI interactions.
  }
}

function mergeNotifications(apiNotifications: Notification[], localNotifications: Notification[]) {
  return sortNotificationsByCreatedAtDesc(
    dedupeNotificationsById([...localNotifications, ...apiNotifications]),
  )
}

export function isLocalOrderFillNotification(notification: Notification) {
  if (notification.id.startsWith(LOCAL_ORDER_FILL_NOTIFICATION_PREFIX)) {
    return true
  }

  const metadata = notification.metadata as Partial<LocalOrderFillMetadata> | undefined
  return metadata?.source === LOCAL_ORDER_FILL_NOTIFICATION_SOURCE
}

function buildLocalOrderFillNotification({
  action,
  txHash,
  title,
  description,
  marketIconUrl,
}: LocalOrderFillNotificationInput): Notification {
  const createdAt = new Date().toISOString()
  const normalizedMarketIcon = typeof marketIconUrl === 'string' ? marketIconUrl.trim() : ''
  const avatarUrl = normalizedMarketIcon && isAllowedAvatarUrl(normalizedMarketIcon)
    ? normalizedMarketIcon
    : LOCAL_ORDER_FILL_AVATAR

  return {
    id: `${LOCAL_ORDER_FILL_NOTIFICATION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: 'trade',
    title,
    description,
    created_at: createdAt,
    user_avatar: avatarUrl,
    link_type: 'external',
    link_label: 'View on Polygonscan',
    link_url: `${POLYGON_SCAN_BASE}/tx/${txHash}`,
    extra_info: txHash.slice(0, 10),
    metadata: {
      source: LOCAL_ORDER_FILL_NOTIFICATION_SOURCE,
      txHash,
      action,
    },
  }
}

export const useNotifications = create<NotificationsState>()((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,
  setNotifications: async () => {
    const localNotifications = readLocalOrderFillNotifications()
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/notifications')

      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const notifications: Notification[] = await response.json()
      set({
        notifications: mergeNotifications(notifications, localNotifications),
        isLoading: false,
      })
    }
    catch {
      set({
        notifications: localNotifications,
        error: 'Failed to fetch notifications',
        isLoading: false,
      })
    }
  },
  addNotification: (notification) => {
    set({
      notifications: sortNotificationsByCreatedAtDesc([notification, ...get().notifications]),
    })
  },
  addLocalOrderFillNotification: (payload) => {
    if (!isLikelyTxHash(payload.txHash)) {
      return
    }

    const localNotification = buildLocalOrderFillNotification(payload)
    const existingLocalNotifications = readLocalOrderFillNotifications()
    const nextLocalNotifications = sortNotificationsByCreatedAtDesc([
      localNotification,
      ...existingLocalNotifications,
    ])

    writeLocalOrderFillNotifications(nextLocalNotifications)
    set({
      notifications: mergeNotifications(get().notifications, [localNotification]),
    })
  },
  removeNotification: async (notificationId) => {
    const currentNotifications = get().notifications
    const targetNotification = currentNotifications.find(notification => notification.id === notificationId)

    if (targetNotification && isLocalOrderFillNotification(targetNotification)) {
      const localNotifications = readLocalOrderFillNotifications()
      const nextLocalNotifications = localNotifications.filter(notification => notification.id !== notificationId)
      writeLocalOrderFillNotifications(nextLocalNotifications)

      set({
        notifications: currentNotifications.filter(notification => notification.id !== notificationId),
      })
      return
    }

    set({ error: null })
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }

      set({ notifications: get().notifications.filter(notification => notification.id !== notificationId) })
    }
    catch {
      set({ error: 'Failed to delete notification' })
      throw new Error('Failed to delete notification')
    }
  },
}))

export function useNotificationList() {
  return useNotifications(state => state.notifications)
}

export function useUnreadNotificationCount() {
  return useNotifications(state => state.notifications.length)
}

export function useNotificationsLoading() {
  return useNotifications(state => state.isLoading)
}

export function useNotificationsError() {
  return useNotifications(state => state.error)
}
