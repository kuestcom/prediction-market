import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getSession: mock(),
  headers: mock(),
}))

void mock.module('next/headers', () => ({
  headers: (...args: any[]) => mocks.headers(...args),
}))

void mock.module('@/lib/auth', () => ({
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

  it('returns the normalized session user for minimal requests', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: {
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
      },
    })

    const user = await UserRepository.getCurrentUser({ minimal: true })

    expect(mocks.getSession).toHaveBeenCalledWith({
      query: {
        disableCookieCache: false,
      },
      headers: expect.any(Headers),
    })
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
