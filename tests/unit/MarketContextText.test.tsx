import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

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

  it('renders open bold markers while the summary is typing', () => {
    const { container } = render(<MarketContextText isTyping>**Down</MarketContextText>)

    expect(screen.getByText('Down').tagName).toBe('STRONG')
    expect(container).not.toHaveTextContent('**')
  })

  it('renders open italic markers while the summary is typing', () => {
    const { container } = render(<MarketContextText isTyping>{'A *path dependency'}</MarketContextText>)

    expect(screen.getByText('path dependency').tagName).toBe('EM')
    expect(container).not.toHaveTextContent('*')
  })

  it('keeps an incomplete marker literal while the summary is typing', () => {
    const { container } = render(<MarketContextText isTyping>{'A trailing *'}</MarketContextText>)

    expect(container).toHaveTextContent('A trailing *')
    expect(container.querySelector('em')).toBeNull()
  })

  it('renders single markdown markers as italic text', () => {
    const { container } = render(<MarketContextText>This is a *path dependency*.</MarketContextText>)

    expect(screen.getByText('path dependency').tagName).toBe('EM')
    expect(container).toHaveTextContent('This is a path dependency.')
    expect(container).not.toHaveTextContent('*')
  })

  it('preserves markdown list prefixes instead of treating them as italics', () => {
    const { container } = render(<MarketContextText>{'* First point\n* Second point'}</MarketContextText>)

    expect(container).toHaveTextContent('* First point * Second point')
    expect(container.querySelector('em')).toBeNull()
  })

  it('renders triple markers as bold italic text', () => {
    const { container } = render(<MarketContextText>This is a ***path dependency***.</MarketContextText>)
    const italicText = screen.getByText('path dependency')

    expect(italicText.tagName).toBe('EM')
    expect(italicText.parentElement?.tagName).toBe('STRONG')
    expect(container).not.toHaveTextContent('*')
  })

  it('preserves an unmatched single marker as literal text', () => {
    const { container } = render(<MarketContextText>This has a stray * marker</MarketContextText>)

    expect(container).toHaveTextContent('This has a stray * marker')
    expect(container.querySelector('em')).toBeNull()
  })

  it('renders emphasis across line breaks', () => {
    const { container } = render(
      <MarketContextText>{'**First line\nsecond line** and *third line\nfourth line*'}</MarketContextText>,
    )

    expect(container.querySelector('strong')).toHaveTextContent('First line second line')
    expect(container.querySelector('em')).toHaveTextContent('third line fourth line')
  })

  it('renders nested emphasis without literal markers', () => {
    const { container } = render(
      <MarketContextText>**market *risk* remains** while *the **path** changes*</MarketContextText>,
    )
    const strongElements = container.querySelectorAll('strong')
    const italicElements = container.querySelectorAll('em')

    expect(strongElements[0]).toHaveTextContent('market risk remains')
    expect(strongElements[0].querySelector('em')).toHaveTextContent('risk')
    expect(italicElements[1]).toHaveTextContent('the path changes')
    expect(italicElements[1].querySelector('strong')).toHaveTextContent('path')
    expect(container).not.toHaveTextContent('*')
  })

  it('renders nested emphasis that shares a terminal delimiter run', () => {
    const { container } = render(<MarketContextText>**market *risk***</MarketContextText>)
    const strongText = container.querySelector('strong')

    expect(strongText).toHaveTextContent('market risk')
    expect(strongText?.querySelector('em')).toHaveTextContent('risk')
    expect(container).not.toHaveTextContent('*')
  })
})
