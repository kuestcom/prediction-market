import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import type { User } from '@/types'

import SettingsDeleteAccountContent from '@/app/[locale]/(platform)/settings/_components/SettingsDeleteAccountContent'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  clearCommunityAuth: mock(),
  deleteAccountAction: mock(),
  deleteCommunityProfileData: mock(),
  deleteRelayerUserDataAction: mock(),
  ensureCommunityToken: mock(),
  openAppKit: mock(),
  parseCommunityError: mock(),
  requestCommunityProfileDeleteNonce: mock(),
  signMessageAsync: mock(),
  signOutAndRedirect: mock(),
  signTypedDataAsync: mock(),
  toastError: mock(),
  useAccount: mock(),
  useIsMobile: mock(() => false),
}))

void mock.module('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

void mock.module('@/components/ui/toast', () => ({
  toast: {
    error: mocks.toastError,
  },
}))

void mock.module('wagmi', () => ({
  useAccount: () => mocks.useAccount(),
  useSignMessage: () => ({
    signMessageAsync: mocks.signMessageAsync,
  }),
  useSignTypedData: () => ({
    signTypedDataAsync: mocks.signTypedDataAsync,
  }),
}))

void mock.module('@/hooks/useAppKit', () => ({
  useAppKit: () => ({
    isReady: true,
    open: mocks.openAppKit,
  }),
}))

void mock.module('@/hooks/useIsMobile', () => ({
  useIsMobile: mocks.useIsMobile,
}))

void mock.module('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({
    communityUrl: 'https://community.example',
  }),
}))

void mock.module('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (callback: () => Promise<string>) => callback(),
  }),
}))

void mock.module('@/app/[locale]/(platform)/settings/_actions/delete-account', () => ({
  deleteAccountAction: () => mocks.deleteAccountAction(),
  deleteRelayerUserDataAction: (input: unknown) => mocks.deleteRelayerUserDataAction(input),
}))

void mock.module('@/lib/community-auth', () => ({
  clearCommunityAuth: mocks.clearCommunityAuth,
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
  parseCommunityError: (...args: unknown[]) => mocks.parseCommunityError(...args),
}))

void mock.module('@/lib/community-profile', () => ({
  deleteCommunityProfileData: (...args: unknown[]) => mocks.deleteCommunityProfileData(...args),
  requestCommunityProfileDeleteNonce: (...args: unknown[]) => mocks.requestCommunityProfileDeleteNonce(...args),
}))

void mock.module('@/lib/logout', () => ({
  signOutAndRedirect: (args: { currentPathname: string }) => mocks.signOutAndRedirect(args),
}))

const USER_ADDRESS = '0x0000000000000000000000000000000000000abc'

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    address: USER_ADDRESS,
    email: 'user@example.com',
    twoFactorEnabled: false,
    username: 'user',
    image: '',
    settings: {},
    is_admin: false,
    deposit_wallet_address: null,
    ...overrides,
  }
}

describe('settingsDeleteAccountContent', () => {
  beforeEach(() => {
    mocks.clearCommunityAuth.mockReset()
    mocks.deleteAccountAction.mockReset()
    mocks.deleteCommunityProfileData.mockReset()
    mocks.deleteRelayerUserDataAction.mockReset()
    mocks.ensureCommunityToken.mockReset()
    mocks.openAppKit.mockReset()
    mocks.parseCommunityError.mockReset()
    mocks.requestCommunityProfileDeleteNonce.mockReset()
    mocks.signMessageAsync.mockReset()
    mocks.signOutAndRedirect.mockReset()
    mocks.signTypedDataAsync.mockReset()
    mocks.toastError.mockReset()
    mocks.useAccount.mockReset()
    mocks.useIsMobile.mockReset()

    mocks.useIsMobile.mockReturnValue(false)
    mocks.useAccount.mockReturnValue({ address: USER_ADDRESS })
    mocks.openAppKit.mockResolvedValue(undefined)
    mocks.ensureCommunityToken.mockResolvedValue('community-token')
    mocks.requestCommunityProfileDeleteNonce.mockResolvedValue({
      expires_at: '2026-06-30T00:00:00.000Z',
      message: 'Kuest Community Data Deletion',
      nonce: 'delete-nonce',
    })
    mocks.signMessageAsync.mockResolvedValue('0xcommunity-signature')
    mocks.deleteCommunityProfileData.mockResolvedValue({
      ok: true,
      status: 200,
    })
    mocks.signTypedDataAsync.mockResolvedValue('0xrelayer-signature')
    mocks.deleteRelayerUserDataAction.mockResolvedValue({})
    mocks.deleteAccountAction.mockResolvedValue({})
    mocks.signOutAndRedirect.mockResolvedValue(undefined)
    window.history.pushState({}, 'test', '/es/settings/account')
  })

  it('renders delete warning copy in the confirmation surface', async () => {
    const user = userEvent.setup()
    render(<SettingsDeleteAccountContent user={createUser()} />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))

    expect(
      screen.getByText(
        'This will permanently delete your account. All your data will be removed and you will be logged out of all devices. This action cannot be undone.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Type DELETE to confirm')).toBeInTheDocument()
  })

  it('only triggers delete action after typing DELETE exactly', async () => {
    const user = userEvent.setup()
    render(<SettingsDeleteAccountContent user={createUser()} />)

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

  it('continues the confirmed delete after the linked wallet connects from the wallet modal', async () => {
    const user = userEvent.setup()
    mocks.useAccount.mockReturnValue({ address: undefined })
    const { rerender } = render(<SettingsDeleteAccountContent user={createUser()} />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mocks.openAppKit).toHaveBeenCalledTimes(1)
    })
    expect(mocks.deleteAccountAction).not.toHaveBeenCalled()

    mocks.useAccount.mockReturnValue({ address: USER_ADDRESS })
    rerender(<SettingsDeleteAccountContent user={createUser()} />)

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
    const pendingDelete: {
      resolve?: (value: Record<string, never>) => void
    } = {}
    mocks.deleteAccountAction.mockImplementationOnce(
      () =>
        new Promise<Record<string, never>>((resolve) => {
          pendingDelete.resolve = resolve
        }),
    )

    render(<SettingsDeleteAccountContent user={createUser()} />)

    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Never mind' })).toBeDisabled()
    })

    pendingDelete.resolve?.({})

    await waitFor(() => {
      expect(mocks.signOutAndRedirect).toHaveBeenCalledWith({
        currentPathname: '/es/settings/account',
      })
    })
  })
})
