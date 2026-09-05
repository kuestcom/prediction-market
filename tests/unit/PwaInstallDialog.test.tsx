import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import PwaInstallDialog from '@/components/PwaInstallDialog'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  useIsMobile: mock(),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('next/image', () => ({
  default: () => <span data-testid="pwa-icon" />,
}))

void mock.module('@/components/PwaInstallIosInstructions', () => ({
  default: () => <span>Follow the Safari instructions</span>,
}))

void mock.module('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div data-testid="install-dialog">{children}</div>,
  DialogClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

void mock.module('@/components/ui/drawer', () => ({
  Drawer: ({ children }: any) => <div data-testid="install-drawer">{children}</div>,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <p>{children}</p>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

void mock.module('@/hooks/useSiteIdentity', () => ({
  useSiteIdentity: () => ({ pwaIcon192Url: '/pwa-icon.png' }),
}))

describe('pwaInstallDialog', () => {
  beforeEach(() => {
    mocks.useIsMobile.mockReset()
  })

  it('uses a dialog on desktop', () => {
    mocks.useIsMobile.mockReturnValue(false)

    render(<PwaInstallDialog open onOpenChange={() => {}} />)

    expect(screen.getByTestId('install-dialog')).toBeInTheDocument()
    expect(screen.queryByTestId('install-drawer')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Install app' })).toBeInTheDocument()
    expect(screen.getByText('Follow the Safari instructions')).toBeInTheDocument()
  })

  it('uses a drawer on mobile and closes it from the close button', async () => {
    mocks.useIsMobile.mockReturnValue(true)
    const onOpenChange = mock()
    const { user } = setup(<PwaInstallDialog open onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.getByTestId('install-drawer')).toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

function setup(component: ReactNode) {
  const user = userEvent.setup()
  render(component)
  return { user }
}
