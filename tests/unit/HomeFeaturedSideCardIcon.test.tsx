import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import HomeFeaturedSideCardIcon from '@/components/HomeFeaturedSideCardIcon'

describe('HomeFeaturedSideCardIcon', () => {
  it('renders a validated featured-card icon without the full dynamic icon catalog', () => {
    render(<HomeFeaturedSideCardIcon name="sparkles" data-testid="featured-icon" />)

    expect(screen.getByTestId('featured-icon').tagName).toBe('svg')
  })
})
