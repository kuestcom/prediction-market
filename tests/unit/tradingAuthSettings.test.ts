import { describe, expect, it } from 'bun:test'

import { TOKEN_APPROVALS_VERSION } from '@/lib/trading-auth/approvals'
import { sanitizeTradingAuthSettings } from '@/lib/trading-auth/utils'

describe('sanitizeTradingAuthSettings', () => {
  it('returns original when tradingAuth is missing', () => {
    const input = { a: 1 }
    expect(sanitizeTradingAuthSettings(input)).toEqual(input)
    expect(sanitizeTradingAuthSettings(null)).toBe(null)
    expect(sanitizeTradingAuthSettings(undefined)).toBe(undefined)
  })

  it('strips keys and exposes trading auth status', () => {
    const input = {
      foo: 'bar',
      tradingAuth: {
        relayer: { key: 'secret-1', updatedAt: '2025-01-01' },
        clob: { key: '', updatedAt: '2025-01-02' },
        approvals: {
          completed: true,
          updatedAt: '2025-01-03',
          version: TOKEN_APPROVALS_VERSION,
          extra: 'ignored',
        },
      },
    }

    expect(sanitizeTradingAuthSettings(input)).toEqual({
      foo: 'bar',
      tradingAuth: {
        relayer: { enabled: true, updatedAt: '2025-01-01' },
        clob: { enabled: false, updatedAt: '2025-01-02' },
        approvals: { enabled: true, updatedAt: '2025-01-03', version: TOKEN_APPROVALS_VERSION },
      },
    })
  })

  it('requires current approval version', () => {
    expect(
      sanitizeTradingAuthSettings({
        tradingAuth: {
          approvals: { completed: true, updatedAt: '2025-01-03' },
        },
      }),
    ).toEqual({
      tradingAuth: {
        approvals: { enabled: false, updatedAt: '2025-01-03', version: undefined },
      },
    })
  })
})
