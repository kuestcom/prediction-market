import { afterEach, describe, expect, it, vi } from 'vitest'

import { isEligibleToReportResolution } from '@/lib/resolution-report-eligibility'

const originalDataUrl = process.env.DATA_URL
const originalMinimum = process.env.RESOLUTION_REPORT_MIN_TRADED_MARKETS

afterEach(() => {
  vi.unstubAllGlobals()
  process.env.DATA_URL = originalDataUrl
  process.env.RESOLUTION_REPORT_MIN_TRADED_MARKETS = originalMinimum
})

describe('resolution report eligibility', () => {
  it('falls back to five traded markets when the configured threshold is fractional', async () => {
    process.env.DATA_URL = 'https://data.example.test'
    process.env.RESOLUTION_REPORT_MIN_TRADED_MARKETS = '1.5'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ traded: 1 }) }))

    await expect(isEligibleToReportResolution('0x1111111111111111111111111111111111111111')).resolves.toBe(false)
  })

  it('accepts a complete positive integer threshold', async () => {
    process.env.DATA_URL = 'https://data.example.test'
    process.env.RESOLUTION_REPORT_MIN_TRADED_MARKETS = '3'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ traded: 3 }) }))

    await expect(isEligibleToReportResolution('0x1111111111111111111111111111111111111111')).resolves.toBe(true)
  })
})
