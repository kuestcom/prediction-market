import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAccountAction } from '@/app/[locale]/(platform)/settings/_actions/delete-account'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  deleteUserAccountById: vi.fn(),
  eraseForAccountDeletion: vi.fn(),
  assertRecentIdentityAuthentication: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
    deleteUserAccountById: (...args: unknown[]) => mocks.deleteUserAccountById(...args),
  },
}))

vi.mock('@/lib/db/queries/identity-privacy', () => ({
  IdentityPrivacyRepository: {
    eraseForAccountDeletion: (...args: unknown[]) => mocks.eraseForAccountDeletion(...args),
  },
}))

vi.mock('@/lib/identity/reauth', () => ({
  assertRecentIdentityAuthentication: (...args: unknown[]) => mocks.assertRecentIdentityAuthentication(...args),
}))

describe('deleteAccountAction identity erasure authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.assertRecentIdentityAuthentication.mockResolvedValue(undefined)
    mocks.eraseForAccountDeletion.mockResolvedValue(undefined)
    mocks.deleteUserAccountById.mockResolvedValue({ error: null })
  })

  it('uses an uncached session and requires recent authentication before erasing identity data', async () => {
    await expect(deleteAccountAction()).resolves.toEqual({})

    expect(mocks.getCurrentUser).toHaveBeenCalledWith({ disableCookieCache: true, minimal: true })
    expect(mocks.assertRecentIdentityAuthentication).toHaveBeenCalledWith('user-1')
    expect(mocks.assertRecentIdentityAuthentication.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.eraseForAccountDeletion.mock.invocationCallOrder[0]!)
    expect(mocks.eraseForAccountDeletion.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deleteUserAccountById.mock.invocationCallOrder[0]!)
  })

  it('does not erase data when recent authentication fails', async () => {
    mocks.assertRecentIdentityAuthentication.mockRejectedValue(new Error('IDENTITY_REAUTHENTICATION_REQUIRED'))

    await expect(deleteAccountAction()).resolves.toHaveProperty('error')
    expect(mocks.eraseForAccountDeletion).not.toHaveBeenCalled()
    expect(mocks.deleteUserAccountById).not.toHaveBeenCalled()
  })
})
