import type { ReactNode } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import EventLiveSeriesChartHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventLiveSeriesChartHeader'

const mocks = vi.hoisted(() => ({ locale: 'en' }))

vi.mock('next-intl', () => ({
  useLocale: () => mocks.locale,
  useExtracted: () => (message: string, values?: Record<string, string | number>) => {
    const translations: Record<string, Record<string, string>> = {
      zh: {
        'Price To Beat': '基准价格',
        'Current price': '当前价格',
        'Final price': '最终价格',
        Days: '天',
        Hours: '小时',
        Minutes: '分钟',
        Seconds: '秒',
        '{count, plural, one {Day} other {Days}}': '{count, plural, one {天} other {天}}',
        '{count, plural, one {Hour} other {Hours}}': '{count, plural, one {小时} other {小时}}',
        '{count, plural, one {Minute} other {Minutes}}': '{count, plural, one {分钟} other {分钟}}',
        '{count, plural, one {Second} other {Seconds}}': '{count, plural, one {秒} other {秒}}',
        '{time} left': '剩余 {time}',
        'Resolution time': '结算时间',
      },
      de: {
        Days: 'Tage',
        Hours: 'Stunden',
        Minutes: 'Minuten',
        Seconds: 'Sekunden',
        '{count, plural, one {Day} other {Days}}': '{count, plural, one {Tag} other {Tage}}',
        '{count, plural, one {Hour} other {Hours}}': '{count, plural, one {Stunde} other {Stunden}}',
        '{count, plural, one {Minute} other {Minutes}}': '{count, plural, one {Minute} other {Minuten}}',
        '{count, plural, one {Second} other {Seconds}}': '{count, plural, one {Sekunde} other {Sekunden}}',
        '{time} left': 'Noch {time}',
      },
      fr: {
        '{count, plural, one {Day} other {Days}}': '{count, plural, one {Jour} other {Jours}}',
        '{count, plural, one {Hour} other {Hours}}': '{count, plural, one {Heure} other {Heures}}',
        '{count, plural, one {Minute} other {Minutes}}': '{count, plural, one {Minute} other {Minutes}}',
        '{count, plural, one {Second} other {Seconds}}': '{count, plural, one {Seconde} other {Secondes}}',
        '{time} left': '{time} restantes',
      },
    }
    const translated = translations[mocks.locale]?.[message] ?? message
    const pluralMatch = translated.match(/^\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}$/)
    if (pluralMatch) {
      return Number(values?.count) === 1 ? pluralMatch[1] : pluralMatch[2]
    }

    return translated.replace('{time}', String(values?.time ?? '{time}'))
  },
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
  beforeEach(() => {
    mocks.locale = 'en'
  })

  it('shows no price to beat when the event has no active baseline', () => {
    render(<EventLiveSeriesChartHeader {...baseProps} resolvedBaselinePrice={null} delta={null} />)

    expect(screen.getByText('Price To Beat').parentElement).toHaveTextContent('Price To Beat--')
  })

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

  it('localizes live price and countdown labels in Chinese', () => {
    mocks.locale = 'zh'

    render(<EventLiveSeriesChartHeader {...baseProps} />)

    expect(screen.getByText('基准价格')).toBeInTheDocument()
    expect(screen.getByText('当前价格')).toBeInTheDocument()
    expect(screen.getByText('小时')).toBeInTheDocument()
    expect(screen.getByText('分钟')).toBeInTheDocument()
    expect(screen.getByText('秒')).toBeInTheDocument()
    expect(screen.queryByText('Price To Beat')).not.toBeInTheDocument()
    expect(screen.queryByText('Current price')).not.toBeInTheDocument()
  })

  it('localizes countdown labels and remaining time for non-Chinese locales', async () => {
    mocks.locale = 'de'

    render(<EventLiveSeriesChartHeader {...baseProps} />)

    expect(screen.getByText('Stunden')).toBeInTheDocument()
    expect(screen.getByText('Minuten')).toBeInTheDocument()
    expect(screen.getByText('Sekunden')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(await screen.findByText('Noch 2 Stunden 7 Minuten 9 Sekunden')).toBeInTheDocument()
    expect(screen.queryByText('HRS')).not.toBeInTheDocument()
    expect(screen.queryByText('2 Hrs 7 Mins 9 Secs left')).not.toBeInTheDocument()
  })

  it('uses countdown-specific French units with singular forms', async () => {
    mocks.locale = 'fr'

    render(
      <EventLiveSeriesChartHeader
        {...baseProps}
        visibleCountdownUnits={[
          { unit: 'hr', value: 1 },
          { unit: 'min', value: 2 },
          { unit: 'sec', value: 1 },
        ]}
      />,
    )

    expect(screen.getByText('Heure')).toBeInTheDocument()
    expect(screen.getByText('Minutes')).toBeInTheDocument()
    expect(screen.getByText('Seconde')).toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(await screen.findByText('1 Heure 2 Minutes 1 Seconde restantes')).toBeInTheDocument()
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
