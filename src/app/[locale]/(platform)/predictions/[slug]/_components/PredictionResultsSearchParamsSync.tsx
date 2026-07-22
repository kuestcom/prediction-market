'use client'

import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import { useSearchParams } from 'next/navigation'
import { useLayoutEffect } from 'react'
import {
  resolvePredictionResultsFiltersFromSearchParams,
} from '@/lib/prediction-results-filters'

function useSyncFiltersFromSearchParams(
  onChange: (nextState: {
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  }) => void,
) {
  const searchParams = useSearchParams()

  useLayoutEffect(function syncFiltersEffect() {
    onChange(resolvePredictionResultsFiltersFromSearchParams(searchParams))
  }, [onChange, searchParams])
}

export default function PredictionResultsSearchParamsSync({
  onChange,
}: {
  onChange: (nextState: {
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  }) => void
}) {
  useSyncFiltersFromSearchParams(onChange)

  return null
}
