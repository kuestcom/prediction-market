import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu', () => {
  it('opens inside a local portal when portalled is false', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent portalled={false}>
          <DropdownMenuItem>Menu item</DropdownMenuItem>
          <DropdownMenuItem render={<button type="button" />} nativeButton>
            Button item
          </DropdownMenuItem>
          <DropdownMenuRadioGroup value="en">
            <DropdownMenuRadioItem value="en" className="[&>span:first-child]:hidden">
              <span>English</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="pt" className="[&>span:first-child]:hidden">
              <span>Portuguese</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(await screen.findByRole('menuitem', { name: 'Menu item' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Button item' }).tagName).toBe('BUTTON')
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeVisible()
    expect(screen.getByRole('menuitemradio', { name: 'Portuguese' })).toBeVisible()
  })

  it('closes after clicking a navigation item', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLinkItem render={<a href="#settings" />}>Settings</DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Settings' }))

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument()
    })
  })
})
