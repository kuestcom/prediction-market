import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'bun:test'
import { useState } from 'react'

import { NumberInput } from '@/components/ui/number-input'

function ControlledNumberInput({ initialValue = 50 }: { initialValue?: number }) {
  const [value, setValue] = useState(initialValue)

  return (
    <>
      <NumberInput value={value} onChange={setValue} ariaLabel="Limit Price" />
      <output aria-label="Price value">{value}</output>
    </>
  )
}

describe('NumberInput', () => {
  it('shifts three typed digits into a one-decimal prediction price', async () => {
    const user = userEvent.setup()

    render(<ControlledNumberInput />)

    const input = screen.getByLabelText('Limit Price')
    await user.clear(input)
    await user.type(input, '333')

    expect(input).toHaveValue('33.3')
    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('33.3')

    await user.type(input, '4')

    expect(input).toHaveValue('33.3')
    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('33.3')

    await user.tab()

    expect(input).toHaveValue('33.3')
    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('33.3')
  })

  it('steps from the normalized typed price with keyboard and buttons', async () => {
    const user = userEvent.setup()

    render(<ControlledNumberInput initialValue={0} />)

    await user.type(screen.getByLabelText('Limit Price'), '333')
    await user.keyboard('{ArrowUp}')

    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('33.4')

    await user.click(screen.getByRole('button', { name: 'Limit Price + 0.1¢' }))

    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('33.5')
  })

  it('steps by one tenth and respects prediction-price bounds', async () => {
    const user = userEvent.setup()

    render(<ControlledNumberInput initialValue={99.8} />)

    const increment = screen.getByRole('button', { name: 'Limit Price + 0.1¢' })
    await user.click(increment)
    await user.click(increment)

    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('99.9')
    expect(increment).toBeDisabled()
  })

  it('starts an empty price at the minimum tradable value', async () => {
    const user = userEvent.setup()

    render(<ControlledNumberInput initialValue={0} />)

    await user.click(screen.getByRole('button', { name: 'Limit Price + 0.1¢' }))

    expect(screen.getByRole('status', { name: 'Price value' })).toHaveTextContent('0.1')
  })
})
