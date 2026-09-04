import { render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import EventOrderPanelSubmitButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelSubmitButton'

void mock.module('next-intl', () => ({
  useExtracted: () => (message: string) => message,
}))

describe('event order panel submit button', () => {
  it('keeps the raised shape but uses muted colors when inactive', () => {
    render(
      <EventOrderPanelSubmitButton
        type="button"
        isLoading={false}
        isDisabled
        onClick={() => {}}
        label="No profitable trade right now"
      />,
    )

    const button = screen.getByRole('button')
    const depth = button.parentElement?.firstElementChild

    expect(button.parentElement).toHaveClass('opacity-50')
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
    expect(depth).toHaveClass('bg-primary/80')
  })

  it('keeps the theme primary color while loading', () => {
    render(
      <EventOrderPanelSubmitButton
        type="button"
        isLoading
        isDisabled
        onClick={() => {}}
        label="Connect wallet"
        loadingLabel="Loading..."
      />,
    )

    const button = screen.getByRole('button')

    expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
    expect(button).not.toHaveClass('bg-muted')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
