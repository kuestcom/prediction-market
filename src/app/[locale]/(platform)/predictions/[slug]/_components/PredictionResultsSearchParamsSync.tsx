'use client'

import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import {
  parsePredictionResultsSort,
  parsePredictionResultsStatus,
  PREDICTION_RESULTS_SORT_PARAM,
  PREDICTION_RESULTS_STATUS_PARAM,
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
  const searchParamsString = searchParams.toString()

  useEffect(() => {
    onChange({
      searchParamsString,
      sort: parsePredictionResultsSort(searchParams.get(PREDICTION_RESULTS_SORT_PARAM)),
      status: parsePredictionResultsStatus(searchParams.get(PREDICTION_RESULTS_STATUS_PARAM)),
    })
  }, [onChange, searchParams, searchParamsString])

  return null
}
