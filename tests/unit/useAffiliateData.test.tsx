import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AffiliateDataResult } from '@/lib/affiliate-data'

import { useAffiliateData } from '@/hooks/useAffiliateData'

const mocks = vi.hoisted(() => ({
  fetchAffiliateSettingsFromAPI: vi.fn<() => Promise<AffiliateDataResult>>(),
}))

vi.mock('@/lib/affiliate-data', () => ({
  fetchAffiliateSettingsFromAPI: mocks.fetchAffiliateSettingsFromAPI,
}))

describe('useAffiliateData', () => {
  beforeEach(() => {
    mocks.fetchAffiliateSettingsFromAPI.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stops loading when the affiliate settings request unexpectedly rejects', async () => {
    const error = new Error('network')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.fetchAffiliateSettingsFromAPI.mockRejectedValue(error)

    const { result } = renderHook(() => useAffiliateData())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith('Unexpected error fetching affiliate settings from API:', error)
  })
})
