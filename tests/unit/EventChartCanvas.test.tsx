import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  predictionChart: vi.fn(),
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function MockPredictionChart(props: unknown) {
      mocks.predictionChart(props)
      return null
    },
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventChartTradeFlow', () => ({
  default: () => null,
}))

const { default: EventChartCanvas } =
  await import('@/app/[locale]/(platform)/event/[slug]/_components/EventChartCanvas')

describe('eventChartCanvas', () => {
  beforeEach(() => {
    mocks.predictionChart.mockClear()
  })

  it('replaces complete history snapshots after a placeholder response', () => {
    render(
      <EventChartCanvas
        chartData={[
          { date: new Date(1_000), market: 40 },
          { date: new Date(2_000), market: 60 },
        ]}
        legendSeries={[{ key: 'market', name: 'Market', color: '#00ff00' }]}
        chartWidth={400}
        chartScopeKey="event:ALL:market"
        onCursorDataChange={vi.fn()}
        isMobile={false}
        isSingleMarket
        chartSettings={{
          autoscale: false,
          xAxis: true,
          yAxis: true,
          horizontalGrid: true,
          verticalGrid: false,
          annotations: false,
        }}
        chartAnnotationMarkers={[]}
        leadingGapStart={null}
        disableResetAnimation={false}
        legendContent={null}
        tradeFlowItems={[]}
      />,
    )

    expect(mocks.predictionChart).toHaveBeenCalledWith(expect.objectContaining({ dataSyncMode: 'replace' }))
  })
})
