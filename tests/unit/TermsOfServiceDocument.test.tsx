import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'bun:test'

import TermsOfServiceDocument from '@/components/TermsOfServiceDocument'

describe('TermsOfServiceDocument', () => {
  it('does not interpret Markdown delimiters inside interpolated site values', () => {
    render(
      <TermsOfServiceDocument
        content="Visit {{siteName}} at {{siteUrl}}."
        siteName="my**site**_name"
        siteUrl="https://my*site*.example"
      />,
    )

    const article = screen.getByRole('article')
    expect(article).toHaveTextContent('Visit my**site**_name at https://my*site*.example.')
    expect(article.querySelector('em')).toBeNull()
    expect(article.querySelector('strong')).toBeNull()
  })

  it('still renders standalone underscore markers as emphasis', () => {
    render(<TermsOfServiceDocument content="_Important_ terms apply." siteName="Kuest" siteUrl="https://kuest.com" />)

    expect(screen.getByRole('article').querySelector('em')).toHaveTextContent('Important')
  })
})
