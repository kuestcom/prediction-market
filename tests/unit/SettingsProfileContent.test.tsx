import type { User } from '@/types'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsProfileContent from '@/app/[locale]/(platform)/settings/_components/SettingsProfileContent'

const mocks = vi.hoisted(() => ({
  clearCommunityAuth: vi.fn(),
  ensureCommunityToken: vi.fn(),
  fetch: vi.fn(),
  invalidateQueries: vi.fn(),
  parseCommunityError: vi.fn(),
  setUserState: vi.fn(),
  signMessageAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateUserAction: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

vi.mock('wagmi', () => ({
  useSignMessage: () => ({
    signMessageAsync: mocks.signMessageAsync,
  }),
}))

vi.mock('@/app/[locale]/(platform)/settings/_actions/update-profile', () => ({
  updateUserAction: (formData: FormData) => mocks.updateUserAction(formData),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}))

vi.mock('@/hooks/useSignaturePromptRunner', () => ({
  useSignaturePromptRunner: () => ({
    runWithSignaturePrompt: (callback: () => Promise<string>) => callback(),
  }),
}))

vi.mock('@/lib/community-auth', () => ({
  clearCommunityAuth: mocks.clearCommunityAuth,
  ensureCommunityToken: (...args: unknown[]) => mocks.ensureCommunityToken(...args),
  parseCommunityError: (...args: unknown[]) => mocks.parseCommunityError(...args),
}))

vi.mock('@/stores/useUser', () => ({
  useUser: {
    setState: mocks.setUserState,
  },
}))

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    address: '0xabc',
    email: 'user@example.com',
    twoFactorEnabled: false,
    username: 'oldname',
    image: '',
    settings: {},
    is_admin: false,
    ...overrides,
  }
}

describe('settingsProfileContent', () => {
  beforeEach(() => {
    mocks.clearCommunityAuth.mockReset()
    mocks.ensureCommunityToken.mockReset()
    mocks.fetch.mockReset()
    mocks.invalidateQueries.mockReset()
    mocks.parseCommunityError.mockReset()
    mocks.setUserState.mockReset()
    mocks.signMessageAsync.mockReset()
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
    mocks.updateUserAction.mockReset()

    mocks.ensureCommunityToken.mockResolvedValue('community-token')
    mocks.updateUserAction.mockResolvedValue({})
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        username: 'newname',
        avatar_url: 'https://community.example/avatar.png',
      }),
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:avatar-preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.stubGlobal('fetch', mocks.fetch)
    process.env.COMMUNITY_URL = 'https://community.example'
  })

  it('does not persist a community avatar_url on username-only saves', async () => {
    const user = userEvent.setup()
    render(<SettingsProfileContent user={createUser()} />)

    const usernameInput = screen.getByLabelText('Username')
    await user.clear(usernameInput)
    await user.type(usernameInput, 'newname')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mocks.updateUserAction).toHaveBeenCalledTimes(1)
    })

    const communityRequest = mocks.fetch.mock.calls.find(([, init]) => {
      return (init as RequestInit | undefined)?.method === 'POST'
    })?.[1] as RequestInit | undefined
    expect(communityRequest).toBeDefined()
    const communityForm = communityRequest!.body as FormData
    const localForm = mocks.updateUserAction.mock.calls[0][0] as FormData

    expect(communityForm.get('username')).toBe('newname')
    expect(communityForm.get('image')).toBeNull()
    expect(localForm.get('username')).toBe('newname')
    expect(localForm.get('avatar_url')).toBeNull()
    const updateUserState = mocks.setUserState.mock.calls[0][0] as (previous: User | null) => User | null
    const previousUser = createUser({
      image: 'https://local.example/avatar.png',
      settings: {
        tradingAuth: {
          approvals: {
            enabled: true,
            updatedAt: '2026-05-16T00:00:00.000Z',
            version: 'current',
          },
        },
      },
    })
    expect(updateUserState(previousUser)).toEqual(expect.objectContaining({
      image: 'https://local.example/avatar.png',
      username: 'newname',
    }))
    expect(updateUserState(previousUser)?.settings).toBe(previousUser.settings)
  })

  it('shows a generic upload error when avatar upload fails with a framework error', async () => {
    const user = userEvent.setup()
    mocks.parseCommunityError.mockResolvedValue(
      'An error occurred in the Server Components render. The specific message is omitted in production builds.',
    )
    mocks.fetch.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: false,
          status: 502,
          json: async () => ({
            error: 'An error occurred in the Server Components render.',
          }),
        }
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          username: 'oldname',
          avatar_url: '',
        }),
      }
    })
    render(<SettingsProfileContent user={createUser()} />)

    const usernameInput = screen.getByLabelText('Username')
    await user.clear(usernameInput)
    await user.type(usernameInput, 'newname')
    const imageInput = document.querySelector<HTMLInputElement>('input[name="image"]')
    expect(imageInput).not.toBeNull()
    await user.upload(imageInput!, new File(['avatar'], 'avatar.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('Could not upload the profile image. Please try again later.')
    })

    expect(screen.getByText('Could not upload the profile image. Please try again later.')).toBeInTheDocument()
    expect(mocks.updateUserAction).not.toHaveBeenCalled()
  })

  it('preserves actionable auth errors when an avatar is selected', async () => {
    const user = userEvent.setup()
    mocks.ensureCommunityToken.mockRejectedValue(new Error('Signature was rejected in your wallet.'))
    render(<SettingsProfileContent user={createUser()} />)

    const imageInput = document.querySelector<HTMLInputElement>('input[name="image"]')
    expect(imageInput).not.toBeNull()
    await user.upload(imageInput!, new File(['avatar'], 'avatar.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('Signature was rejected in your wallet.')
    })

    expect(screen.getByText('Signature was rejected in your wallet.')).toBeInTheDocument()
    expect(mocks.updateUserAction).not.toHaveBeenCalled()
  })
})
