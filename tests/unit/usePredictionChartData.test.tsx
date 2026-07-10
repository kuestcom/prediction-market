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
      expect(result.current.data).toEqual(firstData)
    })

    const replacementData = [
      createPoint(1_000, 100),
      createPoint(1_200, 101),
    ]
    rerender({
      data: replacementData,
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(replacementData)
    })
  })

  it('replaces a point when the incoming data adds a zero-valued series', async () => {
    const initialPoint: DataPoint = {
      date: new Date(1_000),
      yes: 50,
    }
    const replacementPoint: DataPoint = {
      date: new Date(1_000),
      yes: 50,
      no: 0,
    }
    const { result, rerender } = renderHook(
      ({ data }) => usePredictionChartData(data, 'market', 'replace'),
      { initialProps: { data: [initialPoint] } },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([initialPoint])
    })

    rerender({ data: [replacementPoint] })

    await waitFor(() => {
      expect(result.current.data).toEqual([replacementPoint])
    })
  })
})
