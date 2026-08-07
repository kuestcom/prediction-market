import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PwaInstallDialog from '@/components/PwaInstallDialog'

const mocks = vi.hoisted(() => ({
  useIsMobile: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/image', () => ({
  default: () => <span data-testid="pwa-icon" />,
}))

vi.mock('@/components/PwaInstallIosInstructions', () => ({
  default: () => <span>Follow the Safari instructions</span>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div data-testid="install-dialog">{children}</div>,
  DialogClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: any) => <div data-testid="install-drawer">{children}</div>,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <p>{children}</p>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

vi.mock('@/hooks/useSiteIdentity', () => ({
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
    const onOpenChange = vi.fn()
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
