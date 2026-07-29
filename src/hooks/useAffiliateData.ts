'use client'

import { useEffect, useState } from 'react'

import type { AffiliateDataResult } from '@/lib/affiliate-data'

import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'

export function useAffiliateData() {
  const [data, setData] = useState<AffiliateDataResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(function loadAffiliateSettings() {
    let active = true

    async function fetchAffiliateSettings() {
      try {
        const result = await fetchAffiliateSettingsFromAPI()
        if (active) {
          setData(result)
        }
      } catch (error) {
        console.error('Unexpected error fetching affiliate settings from API:', error)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void fetchAffiliateSettings()

    return function cancelAffiliateSettingsUpdate() {
      active = false
    }
  }, [])

  return { data, isLoading }
}
