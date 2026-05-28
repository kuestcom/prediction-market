import type { Notification } from '@/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotifications } from '@/stores/useNotifications'

const LOCAL_ORDER_FILL_STORAGE_KEY = 'header-local-order-fill-notifications-v1'
const DESCRIPTION_SEGMENT_SEPARATOR = ' \u2022 '
const DUPLICATED_DESCRIPTION = [
  'Meta (META) Up or Down on May 27?',
  'Meta (META) Up or Down on May 27?',
  'Received $10.00 @ 40c',
].join(DESCRIPTION_SEGMENT_SEPARATOR)
const DEDUPED_DESCRIPTION = [
  'Meta (META) Up or Down on May 27?',
  'Received $10.00 @ 40c',
].join(DESCRIPTION_SEGMENT_SEPARATOR)

function getStoredLocalNotifications() {
  return JSON.parse(window.localStorage.getItem(LOCAL_ORDER_FILL_STORAGE_KEY) ?? '[]') as Notification[]
}

describe('useNotifications', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useNotifications.setState({
      notifications: [],
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dedupes repeated local order fill description segments before storing', () => {
    useNotifications.getState().addLocalOrderFillNotification({
      action: 'sell',
      title: 'Sell 25 shares on Up',
      description: DUPLICATED_DESCRIPTION,
      eventPath: '/event/meta-up-or-down',
    })

    expect(useNotifications.getState().notifications[0]?.description).toBe(DEDUPED_DESCRIPTION)
    expect(getStoredLocalNotifications()[0]?.description).toBe(DEDUPED_DESCRIPTION)
  })

  it('normalizes existing local order fill notifications from local storage', async () => {
    window.localStorage.setItem(
      LOCAL_ORDER_FILL_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'local-order-fill-existing',
          category: 'trade',
          title: 'Sell 25 shares on Up',
          description: DUPLICATED_DESCRIPTION,
          created_at: '2026-05-28T12:00:00.000Z',
          metadata: {
            source: 'local_order_fill',
            action: 'sell',
          },
        },
      ]),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }))

    await useNotifications.getState().setNotifications()

    expect(useNotifications.getState().notifications[0]?.description).toBe(DEDUPED_DESCRIPTION)
  })
})
