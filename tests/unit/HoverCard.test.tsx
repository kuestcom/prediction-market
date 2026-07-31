import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

describe('HoverCard', () => {
  it('shows a linked preview on hover', async () => {
    const user = userEvent.setup()

    render(
      <HoverCard>
        <HoverCardTrigger render={<a href="https://example.com/profile/alice">Alice</a>} />
        <HoverCardContent>Profile stats</HoverCardContent>
      </HoverCard>,
    )

    await user.hover(screen.getByRole('link', { name: 'Alice' }))

    expect(await screen.findByText('Profile stats')).toBeVisible()
  })
})
