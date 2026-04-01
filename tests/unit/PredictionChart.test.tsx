import { render, waitFor, within } from '@testing-library/react'
import PredictionChart from '@/components/PredictionChart'

const data = [
  { date: new Date('2026-01-01T00:00:00.000Z'), price: 45 },
  { date: new Date('2026-01-01T01:00:00.000Z'), price: 55 },
]

const series = [
  { key: 'price', name: 'Price', color: '#F59E0B' },
]

beforeAll(() => {
  if (typeof SVGElement !== 'undefined' && typeof SVGElement.prototype.getComputedTextLength !== 'function') {
    Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
      configurable: true,
      value() {
        return (this.textContent?.length ?? 0) * 8
      },
    })
  }
})

describe('predictionChart', () => {
  it('honors explicit empty y-axis ticks', async () => {
    const { container } = render(
      <PredictionChart
        data={data}
        series={series}
        width={400}
        height={220}
        showXAxis={false}
        yAxis={{ ticks: [] }}
      />,
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
