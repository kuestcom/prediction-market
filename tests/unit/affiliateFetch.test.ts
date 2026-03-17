import { describe, expect, it, vi } from 'vitest'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'

describe('fetchAffiliateSettingsFromAPI', () => {
  it('returns formatted settings on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tradeFeePercent: 1,
        affiliateSharePercent: 40,
        platformSharePercent: 60,
      }),
    })
    globalThis.fetch = fetchMock as any

    const result = await fetchAffiliateSettingsFromAPI()
    expect(fetchMock).toHaveBeenCalledWith('/api/affiliate-settings', expect.any(Object))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tradeFeePercent).toBe('1.00')
      expect(result.data.tradeFeeDecimal).toBe(0.01)
      expect(result.data.affiliateShareDecimal).toBe(0.4)
    }
  })

  it('returns API error when response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bad request' }),
    })
    globalThis.fetch = fetchMock as any

    const result = await fetchAffiliateSettingsFromAPI()
    expect(result).toEqual({
      success: false,
      error: { error: 'Bad request' },
    })
  })

  it('fails closed on fetch exceptions', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
      globalThis.fetch = fetchMock as any

      const result = await fetchAffiliateSettingsFromAPI()
      expect(result).toEqual({
        success: false,
        error: { error: 'Internal server error' },
      })
      expect(errorSpy).toHaveBeenCalled()
    }
    finally {
      errorSpy.mockRestore()
    }
  })
})
