import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketContextText } from '@/app/[locale]/(platform)/event/[slug]/_components/MarketContextText'

describe('MarketContextText', () => {
  it('renders markdown bold markers as strong text', () => {
    const { container } = render(
      <p>
        <MarketContextText>**Down**, with the contract implying **46.5%**</MarketContextText>
      </p>,
    )

    expect(screen.getByText('Down').tagName).toBe('STRONG')
    expect(screen.getByText('46.5%').tagName).toBe('STRONG')
    expect(container).toHaveTextContent('Down, with the contract implying 46.5%')
    expect(container).not.toHaveTextContent('**')
  })

  it('hides an unfinished opening marker while the summary is typing', () => {
    const { container } = render(<MarketContextText>**Down</MarketContextText>)

    expect(screen.getByText('Down').tagName).toBe('STRONG')
    expect(container).not.toHaveTextContent('**')
  })

  it('renders single markdown markers as italic text', () => {
    const { container } = render(<MarketContextText>This is a *path dependency*.</MarketContextText>)

    expect(screen.getByText('path dependency').tagName).toBe('EM')
    expect(container).toHaveTextContent('This is a path dependency.')
    expect(container).not.toHaveTextContent('*')
  })
})
