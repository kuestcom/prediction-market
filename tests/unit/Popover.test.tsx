import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

describe('Popover', () => {
  it('makes interactive details available on click', async () => {
    const user = userEvent.setup()

    render(
      <Popover>
        <PopoverTrigger render={<button type="button">Open details</button>} />
        <PopoverContent>
          <PopoverTitle>Details</PopoverTitle>
          <a href="https://example.com/details">View details</a>
        </PopoverContent>
      </Popover>,
    )

    await user.click(screen.getByRole('button', { name: 'Open details' }))

    expect(await screen.findByRole('heading', { name: 'Details' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', 'https://example.com/details')
  })
})
