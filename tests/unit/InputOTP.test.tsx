import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'

function ControlledInputOTP({ autoFocus = false }: { autoFocus?: boolean }) {
  const [value, setValue] = useState('')

  return (
    <InputOTP maxLength={6} value={value} onChange={setValue} autoFocus={autoFocus}>
      <InputOTPGroup>
        {Array.from({ length: 6 }, (_, index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

describe('InputOTP', () => {
  it('accepts a complete pasted numeric code', async () => {
    const user = userEvent.setup()
    render(<ControlledInputOTP />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]

    await user.click(inputs[0])
    await user.paste('123456')

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('autofocuses the first slot and supports backspace', async () => {
    const user = userEvent.setup()
    render(<ControlledInputOTP autoFocus />)
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]

    expect(inputs[0]).toHaveFocus()

    await user.type(inputs[0], '123456')
    await user.keyboard('{Backspace}')

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', ''])
  })
})
