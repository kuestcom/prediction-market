import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('keeps native input behavior through the Base UI primitive', async () => {
    const user = userEvent.setup()

    render(<Input aria-label="Name" />)

    const input = screen.getByRole('textbox', { name: 'Name' })
    await user.type(input, 'Kuest')

    expect(input).toHaveValue('Kuest')
  })

  it('exposes Base UI disabled state', () => {
    render(<Input aria-label="Disabled" disabled />)

    expect(screen.getByRole('textbox', { name: 'Disabled' })).toHaveAttribute('data-disabled')
  })
})
