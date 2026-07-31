import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Toggle } from '@/components/ui/toggle'

describe('Toggle', () => {
  it('exposes and changes its pressed state', async () => {
    const user = userEvent.setup()

    render(<Toggle>Bookmark</Toggle>)

    const toggle = screen.getByRole('button', { name: 'Bookmark' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })
})
