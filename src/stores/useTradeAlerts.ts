import { create } from 'zustand'

import type { StoredTradeAlert } from '@/lib/trade-alerts'

interface TradeAlertsState {
  alerts: StoredTradeAlert[]
  enabled: boolean
  profileId: string | null
  permission: NotificationPermission | 'unsupported'
  loading: boolean
  replaceAlerts: (alerts: StoredTradeAlert[]) => void
  prependAlert: (alert: StoredTradeAlert) => void
  setEnabled: (enabled: boolean) => void
  setProfileId: (profileId: string | null) => void
  setPermission: (permission: NotificationPermission | 'unsupported') => void
  setLoading: (loading: boolean) => void
  markAllRead: () => void
  reset: () => void
}

export const useTradeAlertsStore = create<TradeAlertsState>()((set) => ({
  alerts: [],
  enabled: false,
  profileId: null,
  permission: 'unsupported',
  loading: false,
  replaceAlerts: (alerts) => set({ alerts }),
  prependAlert: (alert) =>
    set((state) => ({
      alerts: state.alerts.some((existing) => existing.notification_id === alert.notification_id)
        ? state.alerts
        : [alert, ...state.alerts],
    })),
  setEnabled: (enabled) => set({ enabled }),
  setProfileId: (profileId) => set({ profileId }),
  setPermission: (permission) => set({ permission }),
  setLoading: (loading) => set({ loading }),
  markAllRead: () => set((state) => ({ alerts: state.alerts.map((alert) => ({ ...alert, read: true })) })),
  reset: () => set({ alerts: [], enabled: false, profileId: null, permission: 'unsupported', loading: false }),
}))
