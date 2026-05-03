import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsDeleteAccountContent from '@/app/[locale]/(platform)/settings/_components/SettingsDeleteAccountContent'

const mocks = vi.hoisted(() => ({
  deleteAccountAction: vi.fn(),
  signOutAndRedirect: vi.fn(),
  toastError: vi.fn(),
  useIsMobile: vi.fn(() => false),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
  },
}))

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

vi.mock('@/app/[locale]/(platform)/settings/_actions/delete-account', () => ({
  deleteAccountAction: () => mocks.deleteAccountAction(),
}))

vi.mock('@/lib/logout', () => ({
  signOutAndRedirect: (args: { currentPathname: string }) => mocks.signOutAndRedirect(args),
}))

describe('SettingsDeleteAccountContent', () => {
  beforeEach(() => {
    mocks.deleteAccountAction.mockReset()
    mocks.signOutAndRedirect.mockReset()
    mocks.toastError.mockReset()
    mocks.useIsMobile.mockReset()

    mocks.useIsMobile.mockReturnValue(false)
    mocks.deleteAccountAction.mockResolvedValue({})
    mocks.signOutAndRedirect.mockResolvedValue(undefined)
    window.history.pushState({}, 'test', '/es/settings/account')
  })

  it('renders delete warning copy in the confirmation surface', async () => {
    const user = userEvent.setup()
    render(<SettingsDeleteAccountContent />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(screen.getByText('This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.')).toBeInTheDocument()
    expect(screen.getByText('Type DELETE to confirm')).toBeInTheDocument()
  })

  it('only triggers delete action after typing DELETE exactly', async () => {
    const user = userEvent.setup()
    render(<SettingsDeleteAccountContent />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    const confirmationInput = screen.getByPlaceholderText('DELETE')
    const confirmButton = screen.getByRole('button', { name: 'Confirm' })

    expect(confirmButton).toBeDisabled()

    await user.click(confirmButton)
    expect(mocks.deleteAccountAction).not.toHaveBeenCalled()

    await user.type(confirmationInput, 'delete')
    expect(confirmButton).toBeDisabled()

    await user.clear(confirmationInput)
    await user.type(confirmationInput, 'DELETE')
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    await waitFor(() => {
      expect(mocks.deleteAccountAction).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(mocks.signOutAndRedirect).toHaveBeenCalledWith({
        currentPathname: '/es/settings/account',
      })
    })
  })

  it('keeps dialog controls disabled while delete action is pending', async () => {
    const user = userEvent.setup()
    let resolveDelete: ((value: {}) => void) | null = null
    mocks.deleteAccountAction.mockImplementationOnce(() => (
      new Promise((resolve) => {
        resolveDelete = resolve as (value: {}) => void
      })
    ))

    render(<SettingsDeleteAccountContent />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Never mind' })).toBeDisabled()
    })

    resolveDelete?.({})

    await waitFor(() => {
      expect(mocks.signOutAndRedirect).toHaveBeenCalledWith({
        currentPathname: '/es/settings/account',
      })
    })
  })
})
