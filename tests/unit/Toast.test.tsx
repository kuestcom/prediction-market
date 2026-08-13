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

  it('keeps title full-width while the description shares its row with the action', async () => {
    render(<Toaster />)

    act(() => {
      toast.message('Enable push notifications', {
        description: 'Get trade alerts from people you follow on this device.',
        icon: <span aria-label="Push notifications" role="img" />,
        action: { label: 'Enable', onClick: vi.fn() },
      })
    })

    await screen.findByText('Enable push notifications')
    expect(document.querySelector('[data-slot="toast-content"]')).toHaveClass('grid')
    expect(document.querySelector('[data-slot="toast-body"]')).toHaveClass('col-start-2', 'col-end-4')
    expect(document.querySelector('[data-slot="toast-description-row"]')).toHaveClass('col-start-2', 'col-end-3')
    expect(document.querySelector('[data-slot="toast-actions"]')).toHaveClass('col-start-3', 'row-start-2')
  })

  it('keeps toasts without actions compact', async () => {
    render(<Toaster />)

    act(() => {
      toast.success('Trade alerts enabled.')
    })

    await screen.findByText('Trade alerts enabled.')
    expect(document.querySelector('[data-slot="toast-content"]')).toHaveClass('flex', 'py-3.5')
    expect(document.querySelector('[data-slot="toast-content"]')).not.toHaveClass('grid')
    expect(document.querySelector('[data-slot="toast-media"]')).not.toHaveClass('row-span-2')
  })

  it('supports a compact switch action', async () => {
    const onAction = vi.fn()
    render(<Toaster />)

    act(() => {
      toast.message('Enable push notifications', {
        description: 'Get trade alerts from people you follow on this device.',
        action: { control: 'switch', label: 'Enable', onClick: onAction },
      })
    })

    const switchAction = await screen.findByRole('switch', { name: 'Enable' })
    fireEvent.click(switchAction)
    expect(onAction).toHaveBeenCalledOnce()
    expect(switchAction).toBeChecked()
    expect(switchAction).toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps behind toasts opaque when the stack is expanded', async () => {
    render(<Toaster />)

    act(() => {
      toast.message('First toast')
      toast.message('Second toast')
    })

    await screen.findByText('Second toast')
    const contents = document.querySelectorAll('[data-slot="toast-content"]')
    expect(contents).toHaveLength(2)
    contents.forEach((content) => {
      expect(content).toHaveClass('[&[data-expanded][data-behind]]:opacity-100')
    })
  })

  it('supports an entirely clickable toast without making its close button navigate', async () => {
    const onClick = vi.fn()
    render(<Toaster />)

    act(() => {
      toast.message('Bruno bought 3.33 Up', {
        description: 'Bitcoin Up or Down',
        onClick,
      })
    })

    const clickableToast = await screen.findByRole('link', { name: 'Bruno bought 3.33 Up' })
    fireEvent.click(clickableToast)
    expect(onClick).toHaveBeenCalledOnce()

    fireEvent.keyDown(clickableToast, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(2)

    const closeButton = document.querySelector<HTMLButtonElement>('[data-slot="toast-close"]')
    expect(closeButton).not.toBeNull()
    fireEvent.click(closeButton!)
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
