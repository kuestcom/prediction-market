import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: (...args: any[]) => mocks.headers(...args),
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mocks.getSession(...args),
    },
  },
}))

const { UserRepository } = await import('@/lib/db/queries/user')

describe('userRepository.getCurrentUser', () => {
  beforeEach(() => {
    mocks.getSession.mockReset()
    mocks.headers.mockReset()
    mocks.headers.mockResolvedValue(new Headers())
  })

  it('sanitizes trading auth settings before returning minimal users', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        settings: {
          tradingAuth: {
            relayer: {
              key: 'secret-relayer-key',
              updatedAt: '2026-03-23T00:00:00.000Z',
            },
            clob: {
              key: '',
              updatedAt: '2026-03-23T00:00:00.000Z',
            },
          },
          theme: 'light',
        },
      },
    })

    const user = await UserRepository.getCurrentUser({ minimal: true })

    expect(user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      settings: {
        tradingAuth: {
          relayer: {
            enabled: true,
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
          clob: {
            enabled: false,
            updatedAt: '2026-03-23T00:00:00.000Z',
          },
        },
        theme: 'light',
      },
    })
  })
})
