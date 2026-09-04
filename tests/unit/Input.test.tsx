import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('styles an empty datetime-local value as placeholder text', () => {
    render(<Input aria-label="Start time" type="datetime-local" value="" readOnly />)

    expect(screen.getByLabelText('Start time')).toHaveClass(
      'text-muted-foreground',
      '[&::-webkit-datetime-edit]:text-muted-foreground',
    )
  })
})
