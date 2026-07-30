import { render, waitFor, within } from '@testing-library/react'

import { buildHistoryWithLatestPointOverride } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import PredictionChart from '@/components/PredictionChart'

const data = [
  { date: new Date('2026-01-01T00:00:00.000Z'), price: 45 },
  { date: new Date('2026-01-01T01:00:00.000Z'), price: 55 },
]

const series = [{ key: 'price', name: 'Price', color: '#F59E0B' }]

beforeAll(() => {
  const svgElementPrototype =
    typeof SVGElement === 'undefined'
      ? null
      : (SVGElement.prototype as SVGElement & { getComputedTextLength?: () => number })

  if (svgElementPrototype && typeof svgElementPrototype.getComputedTextLength !== 'function') {
    Object.defineProperty(svgElementPrototype, 'getComputedTextLength', {
      configurable: true,
      value() {
        return (this.textContent?.length ?? 0) * 8
      },
    })
  }
})

describe('predictionChart', () => {
  it('renders a horizontal path for a quote-only market without trade history', async () => {
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
      const linePath = container.querySelector('path[stroke="#F59E0B"]')
      expect(linePath?.getAttribute('d')).toMatch(/^M[^L]+L/)
    })
  })

  it('honors explicit empty y-axis ticks', async () => {
    const { container } = render(
      <PredictionChart data={data} series={series} width={400} height={220} showXAxis={false} yAxis={{ ticks: [] }} />,
    )

    await waitFor(() => {
      expect(container.querySelector('path')).not.toBeNull()
    })

    expect(container.querySelectorAll('text')).toHaveLength(0)
  })

  it('dedupes repeated explicit y-axis ticks', async () => {
    const { container } = render(
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

    expect(await within(container).findAllByText('50%')).toHaveLength(1)
  })

  it('falls back to default ticks when a non-empty explicit y-axis tick array normalizes to empty', async () => {
    const { container } = render(
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

    expect(await within(container).findByText('45%')).toBeInTheDocument()
    expect(within(container).getByText('50%')).toBeInTheDocument()
    expect(within(container).getByText('55%')).toBeInTheDocument()
  })
})
