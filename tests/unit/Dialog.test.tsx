import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

describe('Dialog', () => {
  it('uses Base UI transitions and closes cleanly', async () => {
    const user = userEvent.setup()
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Example dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    const popup = screen.getByRole('dialog', { name: 'Example dialog' })
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]')

    expect(backdrop).toHaveClass('duration-200', 'data-ending-style:opacity-0')
    expect(popup).toHaveClass('duration-200', 'data-ending-style:opacity-0', 'data-ending-style:scale-95')
    expect(popup).not.toHaveClass('data-closed:animate-out')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Example dialog' })).not.toBeInTheDocument()
    })
  })
})
