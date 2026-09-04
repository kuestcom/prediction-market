import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import { Spinner } from '@/components/ui/spinner'

describe('Spinner', () => {
  it('exposes an accessible loading status', () => {
    render(<Spinner />)

    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('data-slot', 'spinner')
  })
})
