import { describe, expect, it } from 'vitest'
import {
  ARBITRAGE_ENABLED_SETTINGS_KEY,
  ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY,
  ARBITRAGE_SETTINGS_GROUP,
  isArbitrageEnabled,
  isArbitrageMultiWalletEnabled,
} from '@/lib/arbitrage-settings'

describe('arbitrage settings', () => {
  it('keeps separate wallets disabled unless the admin explicitly enables them', () => {
    expect(isArbitrageEnabled({
      [ARBITRAGE_SETTINGS_GROUP]: {
        [ARBITRAGE_ENABLED_SETTINGS_KEY]: { value: 'true' },
      },
    })).toBe(true)
    expect(isArbitrageMultiWalletEnabled({
      [ARBITRAGE_SETTINGS_GROUP]: {
        [ARBITRAGE_ENABLED_SETTINGS_KEY]: { value: 'true' },
      },
    })).toBe(false)
  })

  it('enables separate Polymarket wallets from the integration setting', () => {
    expect(isArbitrageMultiWalletEnabled({
      [ARBITRAGE_SETTINGS_GROUP]: {
        [ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY]: { value: 'true' },
      },
    })).toBe(true)
  })

  it.each(['1', 'yes', 'ON', ' enabled '])('accepts the repository boolean form %s', (value) => {
    expect(isArbitrageEnabled({
      [ARBITRAGE_SETTINGS_GROUP]: {
        [ARBITRAGE_ENABLED_SETTINGS_KEY]: { value },
      },
    })).toBe(true)
  })
})
