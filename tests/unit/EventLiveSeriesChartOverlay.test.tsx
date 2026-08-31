import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import EventLiveSeriesChartOverlay from '@/app/[locale]/(platform)/event/[slug]/_components/EventLiveSeriesChartOverlay'

function createCanvasContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return createCanvasContext(this)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventLiveSeriesChartOverlay', () => {
  it.each([
    { isAbove: true, isBelow: false },
    { isAbove: false, isBelow: true },
  ])('draws a pulsing canvas arrow when the target is outside the axis', (targetDirection) => {
    const { container } = render(
      <EventLiveSeriesChartOverlay
        targetLine={{ badgeTop: 280, ...targetDirection }}
        targetLineGuideColor="#5D6878"
        targetBadgeColor="#5D6878"
        currentLineTop={null}
        currentPriceGuideColor="#F59E0B"
      />,
    )

    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    expect(container.querySelector('canvas.animate-pulse')).not.toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('omits the arrow when the target is inside the axis', () => {
    const { container } = render(
      <EventLiveSeriesChartOverlay
        targetLine={{ badgeTop: 140, isAbove: false, isBelow: false }}
        targetLineGuideColor="#5D6878"
        targetBadgeColor="#5D6878"
        currentLineTop={null}
        currentPriceGuideColor="#F59E0B"
      />,
    )

    expect(container.querySelectorAll('canvas')).toHaveLength(1)
  })

  it('renders a localized target label', () => {
    render(
      <EventLiveSeriesChartOverlay
        targetLine={{ badgeTop: 140, isAbove: false, isBelow: false }}
        targetLabel="基准"
        targetLineGuideColor="#5D6878"
        targetBadgeColor="#5D6878"
        currentLineTop={null}
        currentPriceGuideColor="#F59E0B"
      />,
    )

    expect(screen.getByText('基准')).toBeInTheDocument()
    expect(screen.queryByText('Target')).not.toBeInTheDocument()
  })
})
