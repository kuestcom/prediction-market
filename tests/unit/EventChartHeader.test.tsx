import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EventChartHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventChartHeader'
import { OUTCOME_INDEX } from '@/lib/constants'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => (message === 'chance' ? '概率' : message),
}))

vi.mock('react-animated-counter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventSeriesPills', () => ({
  default: () => null,
}))

vi.mock('@/app/[locale]/(platform)/event/[slug]/_components/EventTweetMarketsPanel', () => ({
  default: () => null,
}))

describe('eventChartHeader', () => {
  it('localizes the probability label', () => {
    render(
      <EventChartHeader
        isSingleMarket
        activeOutcomeIndex={OUTCOME_INDEX.YES}
        activeOutcomeLabel="上涨"
        primarySeriesColor="#00ff00"
        yesChanceValue={29}
        effectiveBaselineYesChance={29}
        effectiveCurrentYesChance={29}
        watermark={{}}
      />,
    )

    expect(screen.getByText(/% 概率/)).toBeInTheDocument()
    expect(screen.queryByText(/chance/)).not.toBeInTheDocument()
  })
})
