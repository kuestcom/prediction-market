export const ARBITRAGE_SETTINGS_GROUP = 'integrations'
export const ARBITRAGE_ENABLED_SETTINGS_KEY = 'arbitrage_enabled'
export const ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY = 'arbitrage_multi_wallet_enabled'

type SettingsMap = Record<string, Record<string, { value: string }>>

export function isArbitrageEnabled(settings?: SettingsMap | null) {
  return settings?.[ARBITRAGE_SETTINGS_GROUP]?.[ARBITRAGE_ENABLED_SETTINGS_KEY]?.value === 'true'
}

export function isArbitrageMultiWalletEnabled(settings?: SettingsMap | null) {
  return settings?.[ARBITRAGE_SETTINGS_GROUP]?.[ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY]?.value === 'true'
}
