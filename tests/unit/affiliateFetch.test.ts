import { describe, expect, it, mock, spyOn } from 'bun:test'

import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'

describe('fetchAffiliateSettingsFromAPI', () => {
  it('returns formatted settings on success', async () => {
    const fetchMock = mock().mockResolvedValue({
      ok: true,
      json: async () => ({
        builderTakerSharePercent: 30,
        builderMakerFlatFeePercent: 0,
        affiliateSharePercent: 40,
      }),
    })
    globalThis.fetch = fetchMock as any

    const result = await fetchAffiliateSettingsFromAPI()
    expect(fetchMock).toHaveBeenCalledWith('/api/affiliate-settings', expect.any(Object))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.builderTakerSharePercent).toBe('30.00')
      expect(result.data.builderTakerShareDecimal).toBe(0.3)
      expect(result.data.affiliateShareDecimal).toBe(0.4)
    }
  })

  it('returns API error when response is not ok', async () => {
    const fetchMock = mock().mockResolvedValue({
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
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const fetchMock = mock().mockRejectedValue(new Error('network'))
      globalThis.fetch = fetchMock as any

      const result = await fetchAffiliateSettingsFromAPI()
      expect(result).toEqual({
        success: false,
        error: { error: 'Internal server error' },
      })
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
