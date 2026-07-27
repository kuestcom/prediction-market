import { render, screen } from '@testing-library/react'
import EventOrderPanelAwaitingResolutionDisplay
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelAwaitingResolutionDisplay'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('event order panel awaiting resolution display', () => {
  it('shows the selected market while waiting for the on-chain result', () => {
    render(
      <EventOrderPanelAwaitingResolutionDisplay
        marketTitle="Bitcoin Up or Down - July 27, 4PM ET"
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Hold on, determining winner...')
    expect(screen.getByText('Bitcoin Up or Down - July 27, 4PM ET')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'This market has ended. Final resolution will appear automatically as soon as it is available on-chain.',
    )
  })
})
