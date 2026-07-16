import { describe, expect, it } from 'vitest'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'

describe('arbitrage settings', () => {
  it('keeps separate wallets disabled unless the admin explicitly enables them', () => {
    expect(isArbitrageEnabled({
      integrations: {
        arbitrage_enabled: { value: 'true' },
      },
    })).toBe(true)
    expect(isArbitrageMultiWalletEnabled({
      integrations: {
        arbitrage_enabled: { value: 'true' },
      },
    })).toBe(false)
  })

  it('enables separate Polymarket wallets from the integration setting', () => {
    expect(isArbitrageMultiWalletEnabled({
      integrations: {
        arbitrage_multi_wallet_enabled: { value: 'true' },
      },
    })).toBe(true)
  })
})
