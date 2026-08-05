import { describe, expect, it, vi } from 'vitest'

import { enqueueResolutionReportNotification, flushResolutionReportNotifications } from '@/lib/resolution-report-outbox'

const notification = {
  conditionId: 'condition-1',
  eventId: 'event-1',
  marketId: `0x${'1'.repeat(64)}`,
  outcome: 'yes' as const,
  transactionHash: `0x${'2'.repeat(64)}`,
}

describe('resolution report notification outbox', () => {
  it('keeps failed notifications and removes them after a successful retry', async () => {
    const storage = window.localStorage
    storage.clear()
    enqueueResolutionReportNotification(storage, notification)

    const failedFetch = vi.fn().mockResolvedValue({ ok: false })
    await expect(flushResolutionReportNotifications(storage, failedFetch)).resolves.toBe(1)

    const successfulFetch = vi.fn().mockResolvedValue({ ok: true })
    await expect(flushResolutionReportNotifications(storage, successfulFetch)).resolves.toBe(0)
    expect(successfulFetch).toHaveBeenCalledWith(
      '/api/resolution-reports',
      expect.objectContaining({ body: JSON.stringify(notification) }),
    )
    expect(storage.getItem('kuest:resolution-report-notifications')).toBeNull()
  })
})
