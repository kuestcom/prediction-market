import type { AnchorHTMLAttributes } from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import EventCardMarketsList from '@/app/[locale]/(platform)/(home)/_components/EventCardMarketsList'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

void mock.module('@/i18n/navigation', () => ({
  Link: function MockLink({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

const EVENT = {
  id: 'event-1',
  slug: 'highest-temperature-sao-paulo',
  title: 'Highest temperature in Sao Paulo on June 9?',
  sports_sport_slug: null,
  sports_league_slug: null,
  sports_event_slug: null,
  tags: [],
} as any

describe('eventCardMarketsList', () => {
  it('sorts active markets by descending display chance like the event page', () => {
    render(
      <EventCardMarketsList
        event={EVENT}
        markets={
          [
            {
              condition_id: 'low-market',
              slug: 'low-market',
              title: 'Lower chance market',
              short_title: 'Lower chance',
              volume: 100,
              volume_24h: 0,
              outcomes: [],
              condition: {
                volume: 100,
                resolved: false,
              },
            },
            {
              condition_id: 'high-market',
              slug: 'high-market',
              title: 'Higher chance market',
              short_title: 'Higher chance',
              volume: 100,
              volume_24h: 0,
              outcomes: [],
              condition: {
                volume: 100,
                resolved: false,
              },
            },
          ] as any
        }
        isResolvedEvent={false}
        getDisplayChance={(marketId) => (marketId === 'high-market' ? 72 : 18)}
        resolvedOutcomeIndexByConditionId={{}}
      />,
    )

    const marketLinks = screen
      .getAllByRole('link')
      .filter((link) => link.textContent === 'Higher chance' || link.textContent === 'Lower chance')
    expect(marketLinks.map((link) => link.textContent)).toEqual(['Higher chance', 'Lower chance'])
  })

  it('keeps zero-volume market outcomes visible without a chance when there are no quotes or trades', () => {
    render(
      <EventCardMarketsList
        event={EVENT}
        markets={
          [
            {
              condition_id: 'market-1',
              slug: 'highest-temperature-in-sao-paulo-on-june-9',
              title: 'Highest temperature in Sao Paulo on June 9?',
              short_title: 'Sao Paulo temperature',
              volume: 0,
              volume_24h: 0,
              outcomes: [],
              condition: {
                volume: 0,
                resolved: false,
              },
            },
          ] as any
        }
        isResolvedEvent={false}
        getDisplayChance={() => 50}
        resolvedOutcomeIndexByConditionId={{}}
      />,
    )

    expect(screen.getByText('Sao Paulo temperature')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(screen.queryByText('50%')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        '/event/highest-temperature-sao-paulo/highest-temperature-in-sao-paulo-on-june-9?outcomeIndex=0',
        '/event/highest-temperature-sao-paulo/highest-temperature-in-sao-paulo-on-june-9?outcomeIndex=1',
      ]),
    )
  })

  it('shows a chance for a zero-volume market with planted orders', () => {
    render(
      <EventCardMarketsList
        event={EVENT}
        markets={
          [
            {
              condition_id: 'market-1',
              slug: 'quoted-market',
              title: 'Quoted market',
              short_title: 'Quoted market',
              volume: 0,
              volume_24h: 0,
              outcomes: [
                {
                  outcome_index: 0,
                  outcome_text: 'Yes',
                  buy_price: 0.66,
                  sell_price: 0.62,
                },
                {
                  outcome_index: 1,
                  outcome_text: 'No',
                  buy_price: 0.38,
                  sell_price: 0.34,
                },
              ],
              condition: {
                volume: 0,
                resolved: false,
              },
            },
          ] as any
        }
        isResolvedEvent={false}
        getDisplayChance={() => 64}
        resolvedOutcomeIndexByConditionId={{}}
      />,
    )

    expect(screen.getAllByText('64%').length).toBeGreaterThan(0)
    expect(screen.getByText('36%')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('preserves positional outcome indices when falling back to existing outcome rows', () => {
    render(
      <EventCardMarketsList
        event={EVENT}
        markets={
          [
            {
              condition_id: 'market-1',
              slug: 'indexed-outcomes',
              title: 'Indexed outcomes',
              short_title: 'Indexed outcomes',
              volume: 10,
              volume_24h: 0,
              outcomes: [
                {
                  outcome_index: 4,
                  outcome_text: 'Hotter',
                },
                {
                  outcome_index: 7,
                  outcome_text: 'Cooler',
                },
              ],
              condition: {
                volume: 10,
                resolved: false,
              },
            },
          ] as any
        }
        isResolvedEvent={false}
        getDisplayChance={() => 64}
        resolvedOutcomeIndexByConditionId={{}}
      />,
    )

    expect(screen.getByText('Hotter')).toBeInTheDocument()
    expect(screen.getByText('Cooler')).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        '/event/highest-temperature-sao-paulo/indexed-outcomes?outcomeIndex=4',
        '/event/highest-temperature-sao-paulo/indexed-outcomes?outcomeIndex=7',
      ]),
    )
  })
})
