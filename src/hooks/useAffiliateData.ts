'use client'

import { useEffect, useState } from 'react'

import type { AffiliateDataResult } from '@/lib/affiliate-data'

import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'

export function useAffiliateData() {
  const [data, setData] = useState<AffiliateDataResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(function loadAffiliateSettings() {
    let active = true

    void fetchAffiliateSettingsFromAPI().then((result) => {
      if (active) {
        setData(result)
        setIsLoading(false)
      }
    })

    return function cancelAffiliateSettingsUpdate() {
      active = false
    }
  }, [])

  return { data, isLoading }
}
