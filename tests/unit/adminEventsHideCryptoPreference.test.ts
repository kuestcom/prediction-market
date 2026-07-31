import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY,
  readHideCryptoPreference,
  storeHideCryptoPreference,
  subscribeToHideCryptoPreference,
} from '@/app/[locale]/admin/events/_lib/admin-events-hide-crypto-preference'

describe('admin events Hide crypto preference', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('persists the preference and notifies the current tab', () => {
    const onStoreChange = vi.fn()
    const onPreferenceChange = vi.fn()
    const unsubscribe = subscribeToHideCryptoPreference(onStoreChange, onPreferenceChange)

    storeHideCryptoPreference(true)

    expect(readHideCryptoPreference()).toBe(true)
    expect(onPreferenceChange).toHaveBeenCalledOnce()
    expect(onStoreChange).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('notifies preference changes received from another tab', () => {
    const onStoreChange = vi.fn()
    const onPreferenceChange = vi.fn()
    const unsubscribe = subscribeToHideCryptoPreference(onStoreChange, onPreferenceChange)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY,
        newValue: 'true',
      }),
    )

    expect(onPreferenceChange).toHaveBeenCalledOnce()
    expect(onStoreChange).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('ignores unrelated local storage updates', () => {
    const onStoreChange = vi.fn()
    const onPreferenceChange = vi.fn()
    const unsubscribe = subscribeToHideCryptoPreference(onStoreChange, onPreferenceChange)

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-setting', newValue: 'true' }))

    expect(onPreferenceChange).not.toHaveBeenCalled()
    expect(onStoreChange).not.toHaveBeenCalled()
    unsubscribe()
  })
})
