import type { ChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'

import { defaultChartSettings } from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartControls'

const STORAGE_KEY = 'event-chart-settings'
const chartSettingsListeners = new Set<() => void>()
let cachedChartSettings: ChartSettings = defaultChartSettings

function areChartSettingsEqual(a: ChartSettings, b: ChartSettings) {
  return Object.keys(defaultChartSettings).every((key) => {
    const chartSettingKey = key as keyof ChartSettings
    return Object.is(a[chartSettingKey], b[chartSettingKey])
  })
}

function normalizeChartSettings(settings: Partial<ChartSettings> | ChartSettings | null | undefined): ChartSettings {
  return { ...defaultChartSettings, ...settings }
}

function updateCachedChartSettings(nextSettings: ChartSettings) {
  if (areChartSettingsEqual(cachedChartSettings, nextSettings)) {
    return cachedChartSettings
  }

  cachedChartSettings = nextSettings
  return cachedChartSettings
}

export function loadStoredChartSettings(): ChartSettings {
  if (typeof window === 'undefined') {
    return defaultChartSettings
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return updateCachedChartSettings(defaultChartSettings)
    }
    const parsed = JSON.parse(raw) as Partial<ChartSettings> | null
    if (!parsed || typeof parsed !== 'object') {
      return updateCachedChartSettings(defaultChartSettings)
    }
    return updateCachedChartSettings(normalizeChartSettings(parsed))
  } catch {
    return updateCachedChartSettings(defaultChartSettings)
  }
}

export function storeChartSettings(settings: ChartSettings) {
  const nextSettings = updateCachedChartSettings(normalizeChartSettings(settings))

  if (typeof window === 'undefined') {
    chartSettingsListeners.forEach((listener) => listener())
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings))
  } catch {}

  chartSettingsListeners.forEach((listener) => listener())
}

export function subscribeToChartSettings(listener: () => void) {
  if (typeof window === 'undefined') {
    return function unsubscribeFromChartSettings() {}
  }

  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== STORAGE_KEY) {
      return
    }

    loadStoredChartSettings()
    listener()
  }

  chartSettingsListeners.add(listener)
  window.addEventListener('storage', handleStorage)

  return function unsubscribeFromChartSettings() {
    chartSettingsListeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

export function getStoredChartSettingsServerSnapshot() {
  return defaultChartSettings
}
