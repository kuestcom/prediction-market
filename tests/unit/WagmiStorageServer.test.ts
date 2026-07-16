import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  get: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

describe('wagmi server storage', () => {
  beforeEach(() => {
    mocks.cookies.mockReset()
    mocks.get.mockReset()
    mocks.cookies.mockResolvedValue({ get: mocks.get })
  })

  it('reads only the Wagmi state cookie', async () => {
    mocks.get.mockReturnValue({ value: 'wallet-state' })
    const { getWagmiStateCookieValue } = await import('@/lib/wagmi-storage.server')
    const { WAGMI_STATE_COOKIE_NAME } = await import('@/lib/wagmi-storage')

    await expect(getWagmiStateCookieValue()).resolves.toBe('wallet-state')
    expect(mocks.get).toHaveBeenCalledWith(WAGMI_STATE_COOKIE_NAME)
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })

  it('returns null without persisted Wagmi state', async () => {
    const { getWagmiStateCookieValue } = await import('@/lib/wagmi-storage.server')

    await expect(getWagmiStateCookieValue()).resolves.toBeNull()
  })
})
