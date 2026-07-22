import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import EventLiveSeriesChartHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventLiveSeriesChartHeader'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

const baseProps = {
  resolvedBaselinePrice: 65_051.55,
  headerPriceDisplayDigits: 2,
  currentPrice: 64_702.4,
  delta: -349.15,
  deltaDisplayDigits: 2,
  liveColor: '#F59E0B',
  shouldShowCountdown: true,
  isEventClosed: false,
  liveMarketHref: null,
  isMobile: false,
  isTradingWindowActive: true,
  visibleCountdownUnits: [
    { unit: 'hr' as const, value: 2 },
    { unit: 'min' as const, value: 7 },
    { unit: 'sec' as const, value: 9 },
  ],
  countdownLeftLabel: '2 Hrs 7 Mins 9 Secs',
  etDateLabel: 'Jul 16, 2026',
  etTimeLabel: '12:00 PM',
  utcDateLabel: 'Jul 16, 2026',
  utcTimeLabel: '4:00 PM',
  status: 'live' as const,
  watermark: {
    iconSvg: null,
    iconImageUrl: null,
    label: '',
  },
}

describe('eventLiveSeriesChartHeader', () => {
  it('renders stable formatted prices and zero-padded countdown values', () => {
    const { rerender } = render(<EventLiveSeriesChartHeader {...baseProps} />)

    expect(screen.getByText('$64,702.40')).toBeInTheDocument()
    expect(screen.getByText('HRS').parentElement).toHaveTextContent('02')
    expect(screen.getByText('MINS').parentElement).toHaveTextContent('07')
    expect(screen.getByText('SECS').parentElement).toHaveTextContent('09')

    rerender(
      <EventLiveSeriesChartHeader
        {...baseProps}
        currentPrice={64_703.05}
        visibleCountdownUnits={[
          { unit: 'hr', value: 1 },
          { unit: 'min', value: 59 },
          { unit: 'sec', value: 58 },
        ]}
      />,
    )

    expect(screen.getByText('$64,703.05')).toBeInTheDocument()
    expect(screen.getByText('HR').parentElement).toHaveTextContent('01')
    expect(screen.getByText('MINS').parentElement).toHaveTextContent('59')
    expect(screen.getByText('SECS').parentElement).toHaveTextContent('58')
  })

  it('positions responsive rolling digits using relative font units', () => {
    render(<EventLiveSeriesChartHeader {...baseProps} />)

    const readablePrice = screen.getByText('$64,702.40')
    const visualPrice = readablePrice.nextElementSibling
    const firstDigitStack = visualPrice?.querySelector('span[style]')

    expect(visualPrice).toHaveAttribute('aria-hidden', 'true')
    expect(firstDigitStack).toHaveStyle({ transform: 'translateY(-6em)' })
  })

  it('uses foreground for a closed final price while preserving the delta color', () => {
    render(<EventLiveSeriesChartHeader {...baseProps} isEventClosed />)

    const finalPriceLabel = screen.getByText('Final price')
    const readablePrice = screen.getByText('$64,702.40')
    const finalPriceValue = readablePrice.parentElement?.parentElement
    const delta = screen.getByText('$349.15')

    expect(finalPriceLabel.parentElement).toHaveClass('text-foreground')
    expect(finalPriceValue).toHaveClass('text-foreground')
    expect(delta).toHaveClass('text-no')
  })
})
