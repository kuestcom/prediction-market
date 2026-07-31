import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { Slider } from '@/components/ui/slider'

function ControlledSlider() {
  const [value, setValue] = useState(40)

  return <Slider value={value} min={0} max={100} thumbAriaLabel="Sell percentage" onValueChange={setValue} />
}

describe('Slider', () => {
  it('exposes its value and supports keyboard changes', async () => {
    const user = userEvent.setup()
    render(<ControlledSlider />)

    const slider = screen.getByLabelText('Sell percentage')
    expect(slider).toHaveValue('40')

    slider.focus()
    await user.keyboard('{ArrowRight}')

    expect(slider).toHaveValue('41')
  })

  it('renders one named thumb for each range value', () => {
    render(<Slider defaultValue={[20, 80]} thumbAriaLabel={(index) => `Range limit ${index + 1}`} />)

    expect(screen.getByLabelText('Range limit 1')).toHaveValue('20')
    expect(screen.getByLabelText('Range limit 2')).toHaveValue('80')
  })
})
