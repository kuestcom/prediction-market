'use client'

import type { ReactNode } from 'react'

import { useExtracted, useLocale } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import {
  FollowedTradeAvatar,
  FollowedTradeMarketContext,
  FollowedTradeSummary,
} from '@/components/FollowedTradeNotification'
import { toast } from '@/components/ui/toast'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { detachTradeAlertsBeforeLogout } from '@/hooks/useTradeAlerts'
import { COMMUNITY_AUTH_CHANGED_EVENT, loadCommunityAuth } from '@/lib/community-auth'
import { upsertCommunityPushSubscription } from '@/lib/community-push'
import { buildCommunityApiUrl } from '@/lib/community-url'
import { parseTradeAlertPayload } from '@/lib/trade-alerts'
import {
  cleanupTradeAlerts,
  getTradeAlertsNeedsSync,
  listTradeAlerts,
  putTradeAlert,
  setTradeAlertsNeedsSync,
} from '@/lib/trade-alerts-idb'
import { closeWebSocketWhenReady, createWebSocketReconnectController } from '@/lib/websocket-reconnect'
import { useTradeAlertsStore } from '@/stores/useTradeAlerts'
import { useUser } from '@/stores/useUser'

function extractTradeAlertPayload(value: unknown) {
  if (!value || typeof value !== 'object') {
    return value
  }
  const record = value as Record<string, unknown>
  if (record.type === 'TRADE_ALERT' && record.payload) {
    return record.payload
  }
  if (record.topic === 'following_activity' && record.payload) {
    return record.payload
  }
  if (record.type === 'following_activity' && record.data) {
    return record.data
  }
  return record.payload ?? record.data ?? value
}

async function resolveCommunityProfileId(communityUrl: string, token: string, address: string) {
  const profileUrl = new URL(buildCommunityApiUrl(communityUrl, '/profile'))
  profileUrl.searchParams.set('address', address)
  const response = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    return null
  }
  const profile = (await response.json()) as { id?: string }
  return profile.id?.trim() || null
}

function updateAppBadge(unread: number) {
  const navigatorWithBadge = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (unread > 0) {
    void navigatorWithBadge.setAppBadge?.(unread).catch(() => undefined)
  } else {
    void navigatorWithBadge.clearAppBadge?.().catch(() => undefined)
  }
}

export default function TradeAlertsProvider({ children }: { children: ReactNode }) {
  const t = useExtracted()
  const locale = useLocale()
  const user = useUser()
  const { communityUrl, wsLiveDataUrl } = usePublicRuntimeConfig()
  const currentProfileId = useTradeAlertsStore((state) => state.profileId)
  const [authRevision, setAuthRevision] = useState(0)
  const unread = useTradeAlertsStore((state) => state.alerts.filter((alert) => !alert.read).length)
  const activeRef = useRef(false)
  const previousAddressRef = useRef<string | null>(null)

  useEffect(() => {
    function refreshAuth() {
      setAuthRevision((revision) => revision + 1)
    }
    window.addEventListener(COMMUNITY_AUTH_CHANGED_EVENT, refreshAuth)
    window.addEventListener('storage', refreshAuth)
    return () => {
      window.removeEventListener(COMMUNITY_AUTH_CHANGED_EVENT, refreshAuth)
      window.removeEventListener('storage', refreshAuth)
    }
  }, [])

  useEffect(() => {
    const previousAddress = previousAddressRef.current
    const nextAddress = user?.address ?? null
    previousAddressRef.current = nextAddress
    if (previousAddress && nextAddress && previousAddress.toLowerCase() !== nextAddress.toLowerCase()) {
      void detachTradeAlertsBeforeLogout(communityUrl, previousAddress).catch(() => undefined)
      useTradeAlertsStore.getState().reset()
    }
  }, [communityUrl, user?.address])

  useEffect(() => {
    updateAppBadge(unread)
  }, [unread])

  useEffect(
    function resolveProfileAndLocalAlerts() {
      const token = user?.address ? loadCommunityAuth(user.address)?.token : null
      if (!user?.address || !token) {
        useTradeAlertsStore.getState().reset()
        return
      }

      let cancelled = false
      void (async () => {
        const profileId = currentProfileId ?? (await resolveCommunityProfileId(communityUrl, token, user.address))
        if (!profileId || cancelled) {
          return
        }
        useTradeAlertsStore.getState().setProfileId(profileId)
        const alerts = await listTradeAlerts(window.location.origin, profileId)
        if (!cancelled) {
          useTradeAlertsStore.getState().replaceAlerts(alerts)
        }

        if ((await getTradeAlertsNeedsSync()) && 'Notification' in window && Notification.permission === 'granted') {
          const registration = await navigator.serviceWorker.getRegistration('/')
          const subscription = await registration?.pushManager.getSubscription()
          if (subscription) {
            await upsertCommunityPushSubscription({
              communityApiUrl: communityUrl,
              token,
              subscription,
              locale: document.documentElement.lang || 'en',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            })
            await setTradeAlertsNeedsSync(false)
          }
        }
      })().catch((error) => console.error('Failed to initialize trade alerts', error))

      return () => {
        cancelled = true
      }
    },
    [authRevision, communityUrl, currentProfileId, user?.address],
  )

  useEffect(
    function receiveTradeAlerts() {
      const token = user?.address ? loadCommunityAuth(user.address)?.token : null
      const profileId = useTradeAlertsStore.getState().profileId
      if (!token || !profileId) {
        return
      }
      const communityToken = token

      activeRef.current = true
      async function handlePayload(rawPayload: unknown) {
        const payload = parseTradeAlertPayload(extractTradeAlertPayload(rawPayload), {
          origin: window.location.origin,
        })
        if (!payload || payload.profile_id !== profileId) {
          return
        }
        if (payload.trader && payload.side && typeof payload.shares === 'number') {
          const values = {
            trader: payload.trader,
            shares: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(payload.shares),
            outcome: payload.outcome ?? '',
            marketTitle: payload.market_title,
          }
          payload.message =
            payload.side.toUpperCase() === 'BUY'
              ? t('{trader} bought {shares} {outcome} in {marketTitle}', values)
              : t('{trader} sold {shares} {outcome} in {marketTitle}', values)
        }
        await cleanupTradeAlerts()
        const result = await putTradeAlert(payload, { origin: window.location.origin })
        if (!result.isNew) {
          return
        }
        useTradeAlertsStore.getState().prependAlert(result.alert)
        const hasStructuredSummary = Boolean(payload.trader && payload.side && payload.outcome)
        toast.message(
          hasStructuredSummary ? (
            <FollowedTradeSummary
              trader={payload.trader!}
              side={payload.side!}
              outcome={payload.outcome!}
              averagePrice={payload.average_price}
              totalValue={payload.total_value}
            />
          ) : (
            payload.message
          ),
          {
            id: payload.notification_id,
            description: (
              <FollowedTradeMarketContext
                eventTitle={payload.event_title || payload.market_title}
                eventIcon={payload.event_icon || payload.market_icon}
              />
            ),
            image: (
              <FollowedTradeAvatar
                trader={payload.trader || payload.followed_wallet}
                wallet={payload.followed_wallet}
                src={payload.trader_avatar}
                size={40}
              />
            ),
            onClick: () => window.location.assign(payload.url),
          },
        )
      }

      function handleServiceWorkerMessage(event: MessageEvent) {
        if (event.data?.type === 'TRADE_ALERT_SUBSCRIPTION_CHANGED') {
          void (async () => {
            const registration = await navigator.serviceWorker.getRegistration('/')
            const subscription = await registration?.pushManager.getSubscription()
            if (!subscription) {
              return
            }
            await upsertCommunityPushSubscription({
              communityApiUrl: communityUrl,
              token: communityToken,
              subscription,
              locale: document.documentElement.lang || 'en',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            })
            await setTradeAlertsNeedsSync(false)
          })().catch((error) => console.error('Failed to reconcile Web Push subscription', error))
          return
        }
        void handlePayload(event.data).catch((error) => console.error('Failed to store trade alert', error))
      }
      navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

      let socket: WebSocket | null = null
      let wsUrl: URL
      try {
        wsUrl = new URL(wsLiveDataUrl)
      } catch {
        return () => navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
      }
      wsUrl.searchParams.set('channel', 'following_activity')
      // Public routing hint only. The server still authorizes the subscription
      // with the Community bearer token and verifies that its profile matches.
      wsUrl.searchParams.set('following_profile_id', profileId)

      function connect() {
        if (!activeRef.current || socket) {
          return
        }
        const nextSocket = new WebSocket(wsUrl)
        socket = nextSocket
        nextSocket.onopen = () => {
          nextSocket.send(
            JSON.stringify({
              action: 'subscribe',
              token: communityToken,
              subscriptions: [
                {
                  topic: 'following_activity',
                  type: 'following_activity',
                  filters: {},
                },
              ],
            }),
          )
        }
        nextSocket.onmessage = (event) => {
          try {
            void handlePayload(JSON.parse(String(event.data))).catch((error) =>
              console.error('Failed to store WebSocket trade alert', error),
            )
          } catch {
            // Ignore non-JSON heartbeat and upstream messages.
          }
        }
        nextSocket.onerror = () => nextSocket.close()
        nextSocket.onclose = () => {
          if (socket === nextSocket) {
            socket = null
          }
          reconnectController.scheduleReconnect()
        }
      }

      const reconnectController = createWebSocketReconnectController({
        connect,
        getWebSocket: () => socket,
        isActive: () => activeRef.current,
        resetWebSocket: () => {
          socket = null
        },
        reconnectOnVisible: true,
      })
      document.addEventListener('visibilitychange', reconnectController.handleVisibilityChange)
      connect()

      return () => {
        activeRef.current = false
        navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
        document.removeEventListener('visibilitychange', reconnectController.handleVisibilityChange)
        reconnectController.clearReconnect()
        if (socket) {
          closeWebSocketWhenReady(socket)
          socket = null
        }
      }
    },
    [authRevision, communityUrl, user?.address, wsLiveDataUrl, currentProfileId, locale, t],
  )

  return children
}
