import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { buildHistoryWithLatestPointOverride } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import PredictionChart from '@/components/PredictionChart'

const data = [
  { date: new Date('2026-01-01T00:00:00.000Z'), price: 45 },
  { date: new Date('2026-01-01T01:00:00.000Z'), price: 55 },
]

const series = [{ key: 'price', name: 'Price', color: '#F59E0B' }]

const canvasCalls = {
  arc: vi.fn(),
  bezierCurveTo: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  rect: vi.fn(),
}

function createCanvasContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    arc: canvasCalls.arc,
    beginPath: vi.fn(),
    bezierCurveTo: canvasCalls.bezierCurveTo,
    clearRect: canvasCalls.clearRect,
    clip: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fill: vi.fn(),
    fillText: canvasCalls.fillText,
    lineTo: canvasCalls.lineTo,
    moveTo: canvasCalls.moveTo,
    rect: canvasCalls.rect,
    restore: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  Object.values(canvasCalls).forEach((mock) => mock.mockClear())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return createCanvasContext(this)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('predictionChart', () => {
  it('draws a quote-only market on canvas without SVG chart layers', async () => {
    const start = new Date('2026-07-30T12:00:00.000Z')
    const end = new Date('2026-07-30T13:00:00.000Z')
    const quoteOnlyData = buildHistoryWithLatestPointOverride([], { price: 50 }, end.getTime(), start.getTime())
    const { container } = render(
      <PredictionChart
        data={quoteOnlyData}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showYAxis={false}
        showHorizontalGrid={false}
        disableResetAnimation
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.bezierCurveTo).toHaveBeenCalled()
    })

    expect(container.querySelector('canvas[data-chart-renderer="canvas"]')).not.toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('honors explicit empty y-axis ticks', async () => {
    render(
      <PredictionChart data={data} series={series} width={400} height={220} showXAxis={false} yAxis={{ ticks: [] }} />,
    )

    await waitFor(() => {
      expect(canvasCalls.clearRect).toHaveBeenCalled()
    })

    expect(canvasCalls.fillText).not.toHaveBeenCalled()
  })

  it('dedupes repeated explicit y-axis ticks before drawing labels', async () => {
    render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showHorizontalGrid={false}
        yAxis={{ ticks: [0, 50, 50, 100] }}
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.fillText.mock.calls.length).toBeGreaterThanOrEqual(3)
    })

    expect(canvasCalls.fillText.mock.calls.slice(0, 3).map(([label]) => label)).toEqual(['0%', '50%', '100%'])
  })

  it('falls back to default ticks when explicit ticks normalize to empty', async () => {
    render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showHorizontalGrid={false}
        yAxis={{ ticks: [Number.NaN, Number.POSITIVE_INFINITY] }}
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.fillText.mock.calls.map(([label]) => label)).toContain('55%')
    })

    const labels = canvasCalls.fillText.mock.calls.map(([label]) => label)
    const firstDataLabelIndex = labels.indexOf('45%')
    expect(labels.slice(firstDataLabelIndex, firstDataLabelIndex + 3)).toEqual(['45%', '50%', '55%'])
  })

  it('reports interpolated cursor data from canvas pointer movement', async () => {
    const onCursorDataChange = vi.fn()
    const { getByRole } = render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        onCursorDataChange={onCursorDataChange}
      />,
    )
    const canvas = getByRole('img', { name: 'Interactive prediction chart' })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 220,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await waitFor(() => {
      expect(canvasCalls.clearRect).toHaveBeenCalled()
    })
    fireEvent.pointerMove(canvas, { clientX: 170, clientY: 100 })

    await waitFor(() => {
      expect(onCursorDataChange).toHaveBeenCalled()
    })
    const snapshot = onCursorDataChange.mock.calls.at(-1)?.[0]
    expect(snapshot.values.price).toBeCloseTo(50, 3)
    await waitFor(() => {
      expect(canvasCalls.rect.mock.calls).toContainEqual([170, 26, 170, 186])
    })
  })

  it('does not split the series color when cursor splitting is disabled', async () => {
    const { getByRole } = render(
      <PredictionChart data={data} series={series} width={400} height={220} showXAxis={false} disableCursorSplit />,
    )
    const canvas = getByRole('img', { name: 'Interactive prediction chart' })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 220,
      height: 220,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await waitFor(() => expect(canvasCalls.clearRect).toHaveBeenCalled())
    canvasCalls.rect.mockClear()
    fireEvent.pointerMove(canvas, { clientX: 170, clientY: 100 })

    await waitFor(() => expect(canvasCalls.clearRect.mock.calls.length).toBeGreaterThan(1))
    expect(canvasCalls.rect.mock.calls).not.toContainEqual([170, 26, 170, 186])
  })

  it('keeps curved paths moving forward across uneven timestamps', async () => {
    const unevenData = [
      { date: new Date('2026-01-01T00:00:00.000Z'), price: 45 },
      { date: new Date('2026-01-01T00:59:59.000Z'), price: 55 },
      { date: new Date('2026-01-01T01:00:00.000Z'), price: 52 },
      { date: new Date('2026-01-01T02:00:00.000Z'), price: 54 },
    ]

    render(
      <PredictionChart
        data={unevenData}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showYAxis={false}
        showHorizontalGrid={false}
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.bezierCurveTo).toHaveBeenCalledTimes(3)
    })

    let currentX = canvasCalls.moveTo.mock.calls[0]![0] as number
    canvasCalls.bezierCurveTo.mock.calls.slice(0, 3).forEach(([controlOneX, , controlTwoX, , endX]) => {
      expect(controlOneX).toBeGreaterThanOrEqual(currentX)
      expect(controlTwoX).toBeGreaterThanOrEqual(controlOneX)
      expect(endX).toBeGreaterThanOrEqual(controlTwoX)
      currentX = endX
    })
  })

  it('aligns the live marker with the shifted line endpoint', async () => {
    render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showYAxis={false}
        showHorizontalGrid={false}
        lineEndOffsetX={-34}
        markerOffsetX={-34}
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.arc).toHaveBeenCalledTimes(2)
    })

    const lineEndX = canvasCalls.bezierCurveTo.mock.calls[0]![4]
    const pulseCenterX = canvasCalls.arc.mock.calls[0]![0]
    const markerCenterX = canvasCalls.arc.mock.calls[1]![0]
    expect(pulseCenterX).toBe(lineEndX)
    expect(markerCenterX).toBe(lineEndX)
  })
})
