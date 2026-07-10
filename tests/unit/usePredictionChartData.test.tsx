import type { DataPoint } from '@/types/PredictionChartTypes'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import usePredictionChartData from '@/hooks/usePredictionChartData'

function createPoint(timestamp: number, price: number): DataPoint {
  return {
    date: new Date(timestamp),
    price,
  }
}

describe('usePredictionChartData', () => {
  it('drops an obsolete moving endpoint in replace sync mode', async () => {
    const firstData = [
      createPoint(1_000, 100),
      createPoint(1_100, 100),
    ]
    const { result, rerender } = renderHook(
      ({ data }) => usePredictionChartData(data, 'live-series', 'replace'),
      { initialProps: { data: firstData } },
    )

    await waitFor(() => {
      expect(result.current.data.map(point => point.date.getTime())).toEqual([1_000, 1_100])
    })

    rerender({
      data: [
        createPoint(1_000, 100),
        createPoint(1_200, 101),
      ],
    })

    await waitFor(() => {
      expect(result.current.data.map(point => point.date.getTime())).toEqual([1_000, 1_200])
    })
  })
})
