export const ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY = 'admin-events:hide-crypto'

const ADMIN_EVENTS_HIDE_CRYPTO_CHANGE_EVENT = 'admin-events:hide-crypto-change'

export function readHideCryptoPreference() {
  try {
    return window.localStorage.getItem(ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function getServerHideCryptoPreference() {
  return false
}

export function subscribeToHideCryptoPreference(onStoreChange: () => void, onPreferenceChange: () => void) {
  function notifyPreferenceChange() {
    onPreferenceChange()
    onStoreChange()
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY || event.key === null) {
      notifyPreferenceChange()
    }
  }

  window.addEventListener('storage', handleStorageChange)
  window.addEventListener(ADMIN_EVENTS_HIDE_CRYPTO_CHANGE_EVENT, notifyPreferenceChange)

  return () => {
    window.removeEventListener('storage', handleStorageChange)
    window.removeEventListener(ADMIN_EVENTS_HIDE_CRYPTO_CHANGE_EVENT, notifyPreferenceChange)
  }
}

export function storeHideCryptoPreference(hideCrypto: boolean) {
  try {
    window.localStorage.setItem(ADMIN_EVENTS_HIDE_CRYPTO_STORAGE_KEY, String(hideCrypto))
    window.dispatchEvent(new Event(ADMIN_EVENTS_HIDE_CRYPTO_CHANGE_EVENT))
  } catch {
    // Ignore storage failures; the switch remains at the last persisted value.
  }
}
