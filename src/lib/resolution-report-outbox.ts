export interface ResolutionReportNotification {
  conditionId: string
  eventId: string
  marketId: string
  outcome: 'yes' | 'no'
  transactionHash: string
}

const STORAGE_KEY = 'kuest:resolution-report-notifications'

function readNotifications(storage: Storage): ResolutionReportNotification[] {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? (value as ResolutionReportNotification[]) : []
  } catch {
    return []
  }
}

function writeNotifications(storage: Storage, notifications: ResolutionReportNotification[]) {
  if (notifications.length === 0) {
    storage.removeItem(STORAGE_KEY)
    return
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

export function enqueueResolutionReportNotification(storage: Storage, notification: ResolutionReportNotification) {
  const notifications = readNotifications(storage).filter(
    (item) => item.transactionHash.toLowerCase() !== notification.transactionHash.toLowerCase(),
  )
  writeNotifications(storage, [...notifications, notification])
}

export async function flushResolutionReportNotifications(storage: Storage, fetcher: typeof fetch = fetch) {
  const pending = readNotifications(storage)
  const remaining: ResolutionReportNotification[] = []

  for (const notification of pending) {
    try {
      const response = await fetcher('/api/resolution-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      })
      if (!response.ok) {
        remaining.push(notification)
      }
    } catch {
      remaining.push(notification)
    }
  }

  writeNotifications(storage, remaining)
  return remaining.length
}
