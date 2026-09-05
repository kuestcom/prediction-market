import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  predictionChart: mock(),
}))

void mock.module('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function MockPredictionChart(props: unknown) {
      mocks.predictionChart(props)
      return null
    },
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_components/EventChartTradeFlow', () => ({
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
        onCursorDataChange={mock()}
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

  it('formats tooltip timestamps with the page locale', () => {
    render(
      <EventChartCanvas
        chartData={[]}
        locale="zh"
        legendSeries={[{ key: 'market', name: '上涨', color: '#00ff00' }]}
        chartWidth={400}
        chartScopeKey="event:ALL:market"
        onCursorDataChange={mock()}
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

    const props = mocks.predictionChart.mock.lastCall?.[0] as {
      tooltipDateFormatter: (date: Date) => string
    }
    const date = new Date('2026-08-30T19:33:00.000Z')

    expect(props.tooltipDateFormatter(date)).toBe(
      date.toLocaleString('zh', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    )
  })
})
