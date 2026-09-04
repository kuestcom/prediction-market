import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import { Slider } from '@/components/ui/slider'

describe('Slider', () => {
  it('renders one named thumb for each range value', () => {
    render(<Slider defaultValue={[20, 80]} thumbAriaLabel={(index) => `Range limit ${index + 1}`} />)

    expect(screen.getByLabelText('Range limit 1')).toHaveValue('20')
    expect(screen.getByLabelText('Range limit 2')).toHaveValue('80')
  })
})
