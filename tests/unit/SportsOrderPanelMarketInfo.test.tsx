import { render, screen } from '@testing-library/react'
import SportsOrderPanelMarketInfo
  from '@/app/[locale]/(platform)/sports/_components/_sports-games-center/SportsOrderPanelMarketInfo'

vi.mock('@/components/EventIconImage', () => ({
  default: ({ src, alt }: { src: string, alt: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}))

describe('sportsOrderPanelMarketInfo', () => {
  it('uses the event icon and card title for standalone UFC auxiliary markets', () => {
    const market = {
      condition_id: 'fight-ko',
      sports_market_type: 'ufc_method_of_victory',
      sports_group_item_title: 'Fight won by KO/TKO?',
      short_title: 'Fight won by KO/TKO?',
      title: 'Fight won by KO/TKO?',
      outcomes: [
        { outcome_index: 0, outcome_text: 'Yes' },
        { outcome_index: 1, outcome_text: 'No' },
      ],
    }
    const selectedButton = {
      key: 'fight-ko:0',
      conditionId: 'fight-ko',
      outcomeIndex: 0,
      fallbackIsNoOutcome: false,
      label: 'YES',
      cents: 48,
      color: null,
      marketType: 'binary',
      tone: 'over',
    } as const
    const card = {
      title: 'Holloway vs McGregor',
      event: {
        icon_url: '/ufc-event.png',
        title: 'UFC Max 1: Holloway vs McGregor',
        sports_sport_slug: 'mma',
        tags: [{ slug: 'sports' }],
        main_tag: 'sports',
      },
      teams: [
        { name: 'Max Holloway', abbreviation: 'MAX' },
        { name: 'Conor McGregor', abbreviation: 'CON' },
      ],
      buttons: [selectedButton],
      detailMarkets: [market],
    }

    render(
      <SportsOrderPanelMarketInfo
        card={card as any}
        selectedButton={selectedButton}
        selectedOutcome={market.outcomes[0] as any}
        marketType="binary"
      />,
    )

    expect(screen.getByText('Fight won by KO/TKO?')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'UFC Max 1: Holloway vs McGregor' })).toHaveAttribute(
      'data-src',
      '/ufc-event.png',
    )
  })
})
