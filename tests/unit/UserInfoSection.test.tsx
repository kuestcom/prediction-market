import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, mock } from 'bun:test'

import UserInfoSection from '@/components/UserInfoSection'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  copy: mock(),
}))

void mock.module('@/hooks/useClipboard', () => ({
  useClipboard: () => ({ copied: false, copy: mocks.copy }),
}))

void mock.module('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

void mock.module('@/stores/useUser', () => ({
  useUser: () => ({
    address: '0x1234567890abcdef',
    deposit_wallet_address: '0x1234567890abcdef',
    image: '',
    username: 'trader',
  }),
}))

describe('UserInfoSection', () => {
  it('copies the address without activating the containing menu item', () => {
    const onMenuItemClick = mock()

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
