'use client'

import { useEffect, useState } from 'react'

import type { AffiliateDataResult } from '@/lib/affiliate-data'

import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'

export function useAffiliateData() {
  const [data, setData] = useState<AffiliateDataResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(function loadAffiliateSettings() {
    fetchAffiliateSettingsFromAPI()
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading }
}
