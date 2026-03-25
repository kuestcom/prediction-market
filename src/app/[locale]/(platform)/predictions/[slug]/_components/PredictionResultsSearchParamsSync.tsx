'use client'

import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import {
  resolvePredictionResultsFiltersFromSearchParams,
} from '@/lib/prediction-results-filters'

export default function PredictionResultsSearchParamsSync({
  onChange,
}: {
  onChange: (nextState: {
    searchParamsString: string
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  }) => void
}) {
  const searchParams = useSearchParams()

  useEffect(() => {
    onChange(resolvePredictionResultsFiltersFromSearchParams(searchParams))
  }, [onChange, searchParams])

  return null
}
