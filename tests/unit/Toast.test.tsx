import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Toaster, toast } from '@/components/ui/toast'

describe('Toast', () => {
  afterEach(() => {
    toast.dismiss()
  })

  it('renders rich descriptions and custom media', async () => {
    render(<Toaster />)

    act(() => {
      toast.success('Trade complete', {
        description: <strong>10 shares bought</strong>,
        icon: <span data-testid="custom-icon">✓</span>,
        image: <span aria-label="Market thumbnail" role="img" />,
      })
    })

    expect(await screen.findByText('Trade complete')).toBeVisible()
    expect(screen.getByText('10 shares bought')).toBeVisible()
    expect(screen.getByTestId('custom-icon')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Market thumbnail' })).toBeVisible()
  })

  it('renders block description content without nesting it in a paragraph', async () => {
    render(<Toaster />)

    act(() => {
      toast.success('Trade complete', {
        description: <div data-testid="trade-description">10 shares bought</div>,
      })
    })

    const description = (await screen.findByTestId('trade-description')).closest('[data-slot="toast-description"]')
    expect(description?.tagName).toBe('DIV')
  })

  it('renders above modal overlays', () => {
    render(<Toaster />)

    expect(document.querySelector('[data-slot="toast-viewport"]')).toHaveClass('z-[100]')
  })

  it('renders custom content and actions', async () => {
    const onAction = vi.fn()
    render(<Toaster />)

    act(() => {
      toast('Ignored when custom content is present', {
        action: { label: 'Undo', onClick: onAction },
        content: <div>Custom trade content</div>,
      })
    })

    expect(await screen.findByText('Custom trade content')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})
