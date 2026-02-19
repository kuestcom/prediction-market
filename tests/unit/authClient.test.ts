import { describe, expect, it, vi } from 'vitest'

const pluginMocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  siweClient: vi.fn(() => ({ name: 'siwe' })),
  twoFactorClient: vi.fn((options: any) => ({ name: '2fa', options })),
}))

vi.mock('better-auth/react', () => ({
  createAuthClient: pluginMocks.createAuthClient,
}))

vi.mock('better-auth/client/plugins', () => ({
  siweClient: pluginMocks.siweClient,
  twoFactorClient: pluginMocks.twoFactorClient,
}))

describe('authClient', () => {
  it('wires the 2FA redirect callback', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { href: '', pathname: '/pt/portfolio', search: '?tab=open' },
      writable: true,
    })

    try {
      await import('@/lib/auth-client')

      expect(pluginMocks.createAuthClient).toHaveBeenCalled()
      const args = pluginMocks.createAuthClient.mock.calls[0]?.[0]
      expect(args.plugins).toHaveLength(2)

      const twoFactorPlugin = args.plugins[1]
      expect(twoFactorPlugin.name).toBe('2fa')

      twoFactorPlugin.options.onTwoFactorRedirect()
      expect(window.location.href).toBe('/pt/2fa?next=%2Fpt%2Fportfolio%3Ftab%3Dopen')

      window.location.pathname = '/portfolio'
      window.location.search = ''
      twoFactorPlugin.options.onTwoFactorRedirect()
      expect(window.location.href).toBe('/2fa?next=%2Fportfolio')
    }
    finally {
      Object.defineProperty(window, 'location', { value: originalLocation })
    }
  })
})
