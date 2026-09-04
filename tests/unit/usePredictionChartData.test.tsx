import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import type { DataPoint } from '@/types/PredictionChartTypes'

import usePredictionChartData from '@/hooks/usePredictionChartData'

function createPoint(timestamp: number, price: number): DataPoint {
  return {
    date: new Date(timestamp),
    price,
  }
}

describe('usePredictionChartData', () => {
  it('drops an obsolete moving endpoint in replace sync mode', async () => {
    const firstData = [createPoint(1_000, 100), createPoint(1_100, 100)]
    const { result, rerender } = renderHook(({ data }) => usePredictionChartData(data, 'live-series', 'replace'), {
      initialProps: { data: firstData },
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(firstData)
    })

    const replacementData = [createPoint(1_000, 100), createPoint(1_200, 101)]
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
    const { result, rerender } = renderHook(({ data }) => usePredictionChartData(data, 'market', 'replace'), {
      initialProps: { data: [initialPoint] },
    })

    await waitFor(() => {
      expect(result.current.data).toEqual([initialPoint])
    })

    rerender({ data: [replacementPoint] })

    await waitFor(() => {
      expect(result.current.data).toEqual([replacementPoint])
    })
  })

  it('replaces a sparse placeholder when complete history arrives for the same chart', async () => {
    const oldHistory: DataPoint[] = [
      { date: new Date(1_000), oldMarket: 40 },
      { date: new Date(2_000), oldMarket: 60 },
    ]
    const sparsePlaceholder: DataPoint[] = [{ date: new Date(1_000) }, { date: new Date(2_000), newMarket: 55 }]
    const completeHistory: DataPoint[] = [
      { date: new Date(1_000), newMarket: 35 },
      { date: new Date(1_500), newMarket: 45 },
      { date: new Date(2_000), newMarket: 55 },
    ]
    const { result, rerender } = renderHook(
      ({ data, signature }) => usePredictionChartData(data, signature, 'replace'),
      {
        initialProps: { data: oldHistory, signature: 'old-event' },
      },
    )

    await waitFor(() => {
      expect(result.current.data).toEqual(oldHistory)
    })

    rerender({ data: sparsePlaceholder, signature: 'new-event' })
    await waitFor(() => {
      expect(result.current.data).toEqual(sparsePlaceholder)
    })

    rerender({ data: completeHistory, signature: 'new-event' })
    await waitFor(() => {
      expect(result.current.data).toEqual(completeHistory)
    })
  })

  it('does not append when a sparse series is equivalent to zero', async () => {
    const initialData: DataPoint[] = [
      {
        date: new Date(1_000),
        yes: 0,
      },
    ]
    const { result, rerender } = renderHook(({ data }) => usePredictionChartData(data, 'market'), {
      initialProps: { data: initialData },
    })

    await waitFor(() => {
      expect(result.current.data).toBe(initialData)
    })

    rerender({ data: [{ date: new Date(1_000) }] })

    await waitFor(() => {
      expect(result.current.lastDataUpdateTypeRef.current).toBe('none')
      expect(result.current.data).toBe(initialData)
    })
  })
})
