import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  actions: vi.fn(),
  createClient: vi.fn(),
  decryptSecret: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@lifi/sdk', () => ({
  actions: (...args: any[]) => mocks.actions(...args),
  createClient: (...args: any[]) => mocks.createClient(...args),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/encryption', () => ({
  decryptSecret: (...args: any[]) => mocks.decryptSecret(...args),
}))

describe('getLiFiServerActions', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.actions.mockReset()
    mocks.createClient.mockReset()
    mocks.decryptSecret.mockReset()
    mocks.getSettings.mockReset()

    mocks.createClient.mockImplementation((config: unknown) => ({ config }))
    mocks.actions.mockImplementation((client: unknown) => ({
      client,
      getQuote: vi.fn(),
    }))
  })

  it('uses the default client when the first settings read fails', async () => {
    mocks.getSettings.mockResolvedValueOnce({ data: null, error: 'Temporary settings failure.' })

    const { getLiFiServerActions } = await import('@/lib/lifi')
    const lifi = await getLiFiServerActions()

    expect(lifi).toBe(mocks.actions.mock.results[0].value)
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
    expect(mocks.createClient).toHaveBeenCalledWith({ integrator: 'lifi-sdk' })
  })

  it('keeps the configured client when a later settings read fails', async () => {
    mocks.getSettings
      .mockResolvedValueOnce({
        data: {
          general: {
            lifi_integrator: { value: 'kuest-prod' },
            lifi_api_key: { value: 'enc.v1.lifi-key' },
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: 'Temporary settings failure.' })
    mocks.decryptSecret.mockReturnValue('lifi-key')

    const { getLiFiServerActions } = await import('@/lib/lifi')
    const configuredLiFi = await getLiFiServerActions()
    const fallbackLiFi = await getLiFiServerActions()

    expect(fallbackLiFi).toBe(configuredLiFi)
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
    expect(mocks.createClient).toHaveBeenCalledWith({
      integrator: 'kuest-prod',
      apiKey: 'lifi-key',
    })
  })
})
