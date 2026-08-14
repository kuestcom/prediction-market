import { act, fireEvent, render, waitFor } from '@testing-library/react'
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
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
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
    createLinearGradient: canvasCalls.createLinearGradient,
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
    fireEvent.pointerMove(canvas, { clientX: 164, clientY: 100 })

    await waitFor(() => {
      expect(onCursorDataChange).toHaveBeenCalled()
    })
    const snapshot = onCursorDataChange.mock.calls.at(-1)?.[0]
    expect(snapshot.values.price).toBeCloseTo(50, 3)
    await waitFor(() => {
      expect(canvasCalls.rect.mock.calls).toContainEqual([164, 26, 176, 186])
    })
  })

  it('places the normal-chart cursor on the rendered curve and restores color from that point', async () => {
    const onCursorDataChange = vi.fn()
    const curvedData = [
      { date: data[0].date, price: 20 },
      { date: data[1].date, price: 80 },
    ]
    const { getByRole } = render(
      <PredictionChart
        data={curvedData}
        series={series}
        width={400}
        height={220}
        yAxis={{ min: 0, max: 100, ticks: [] }}
        showXAxis={false}
        showYAxis={false}
        showHorizontalGrid={false}
        lineCurve="monotoneX"
        disableResetAnimation
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

    await waitFor(() => expect(canvasCalls.clearRect).toHaveBeenCalled())
    canvasCalls.arc.mockClear()
    fireEvent.pointerMove(canvas, { clientX: 94, clientY: 100 })

    await waitFor(() => {
      expect(onCursorDataChange.mock.calls.at(-1)?.[0]?.values.price).toBeCloseTo(26.354, 2)
      expect(canvasCalls.arc.mock.calls.at(-1)?.[0]).toBeCloseTo(94, 2)
      expect(canvasCalls.arc.mock.calls.at(-1)?.[1]).toBeCloseTo(161.09, 1)
    })

    canvasCalls.rect.mockClear()
    fireEvent.pointerLeave(canvas)
    await waitFor(() => {
      expect(canvasCalls.rect.mock.calls).toContainEqual([94, 26, 294, 186])
    })
  })

  it('keeps a stationary live cursor attached to the latest series line', async () => {
    const onCursorDataChange = vi.fn()
    function renderChart(nextData: typeof data, domain = { start: data[0].date, end: data[1].date }) {
      return (
        <PredictionChart
          data={nextData}
          series={series}
          dataSyncMode="replace"
          width={400}
          height={220}
          xDomain={domain}
          yAxis={{ min: 0, max: 100, ticks: [] }}
          showXAxis={false}
          showYAxis={false}
          showHorizontalGrid={false}
          disableResetAnimation
          onCursorDataChange={onCursorDataChange}
        />
      )
    }
    const { getByRole, rerender } = render(renderChart(data))
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
    fireEvent.pointerMove(canvas, { clientX: 188, clientY: 100 })
    await waitFor(() => {
      expect(onCursorDataChange.mock.calls.at(-1)?.[0]?.values.price).toBeCloseTo(50, 3)
    })

    canvasCalls.arc.mockClear()
    const updatedData = [
      { date: data[0].date, price: 60 },
      { date: data[1].date, price: 80 },
      { date: new Date('2026-01-01T02:00:00.000Z'), price: 100 },
    ]
    rerender(
      renderChart(updatedData, {
        start: new Date('2026-01-01T00:30:00.000Z'),
        end: new Date('2026-01-01T01:30:00.000Z'),
      }),
    )

    await waitFor(() => {
      expect(onCursorDataChange.mock.calls.at(-1)?.[0]?.values.price).toBeCloseTo(80, 3)
    })
    await waitFor(() => {
      const latestCursorY = canvasCalls.arc.mock.calls.at(-1)?.[1]
      expect(latestCursorY).toBeCloseTo(65.6, 1)
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
        disableResetAnimation
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.bezierCurveTo.mock.calls.length).toBeGreaterThanOrEqual(3)
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
        disableResetAnimation
      />,
    )

    await waitFor(() => {
      expect(canvasCalls.arc.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    const lineEndX = canvasCalls.bezierCurveTo.mock.calls[0]![4]
    const pulseCenterX = canvasCalls.arc.mock.calls[0]![0]
    const markerCenterX = canvasCalls.arc.mock.calls[1]![0]
    expect(pulseCenterX).toBe(lineEndX)
    expect(markerCenterX).toBe(lineEndX)
  })

  it('reveals the chart before sweeping a highlight into the end marker', async () => {
    const animationFrames: FrameRequestCallback[] = []
    vi.spyOn(window.performance, 'now').mockReturnValue(1_000)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })

    render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        showYAxis={false}
        showHorizontalGrid={false}
      />,
    )

    await waitFor(() => expect(animationFrames.length).toBeGreaterThan(0))
    expect(canvasCalls.arc).not.toHaveBeenCalled()

    canvasCalls.rect.mockClear()
    act(() => animationFrames.shift()?.(1_700))
    const partialRevealClip = canvasCalls.rect.mock.calls.find(
      ([left, top, width, height]) => left === -4 && top === 26 && height === 186 && width > 8 && width < 396,
    )
    expect(partialRevealClip).toBeDefined()
    expect(canvasCalls.arc).not.toHaveBeenCalled()

    act(() => animationFrames.shift()?.(2_400))
    expect(canvasCalls.arc).toHaveBeenCalled()

    canvasCalls.createLinearGradient.mockClear()
    act(() => animationFrames.shift()?.(2_780))
    expect(canvasCalls.createLinearGradient).toHaveBeenCalled()
  })
})
