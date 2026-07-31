import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

describe('ToggleGroup', () => {
  it('keeps a single selected item and supports arrow-key focus', async () => {
    const user = userEvent.setup()

    render(
      <ToggleGroup defaultValue={['active']} aria-label="Status">
        <ToggleGroupItem value="active">Active</ToggleGroupItem>
        <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
      </ToggleGroup>,
    )

    const active = screen.getByRole('button', { name: 'Active' })
    const closed = screen.getByRole('button', { name: 'Closed' })

    expect(active).toHaveAttribute('aria-pressed', 'true')
    active.focus()
    await user.keyboard('{ArrowRight}')
    expect(closed).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(active).toHaveAttribute('aria-pressed', 'false')
    expect(closed).toHaveAttribute('aria-pressed', 'true')
  })
})
