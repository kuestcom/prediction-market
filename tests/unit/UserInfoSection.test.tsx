import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import UserInfoSection from '@/components/UserInfoSection'

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
}))

vi.mock('@/hooks/useClipboard', () => ({
  useClipboard: () => ({ copied: false, copy: mocks.copy }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0x1234567890abcdef',
    deposit_wallet_address: '0x1234567890abcdef',
    image: '',
    username: 'trader',
  }),
}))

describe('UserInfoSection', () => {
  it('copies the address without activating the containing menu item', () => {
    const onMenuItemClick = vi.fn()

    render(
      <div onClick={onMenuItemClick}>
        <UserInfoSection />
      </div>,
    )

    fireEvent.click(screen.getByTitle('Copy address'))

    expect(mocks.copy).toHaveBeenCalledWith('0x1234567890abcdef')
    expect(onMenuItemClick).not.toHaveBeenCalled()
  })
})
