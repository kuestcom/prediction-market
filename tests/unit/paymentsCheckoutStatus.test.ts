import { afterEach, describe, expect, it, jest, mock, spyOn } from 'bun:test'

const storedKey = 'S'.repeat(43)

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: mock().mockResolvedValue({
      data: {
        payments: {
          on_off_ramp_enabled: { value: 'false' },
          operator_key: { value: `encrypted:${storedKey}` },
          operator_domain: { value: 'fork.example' },
        },
      },
      error: null,
    }),
  },
}))

void mock.module('@/lib/encryption', () => ({
  decryptSecret: (value: string) => (value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : ''),
}))

const originalSiteUrl = process.env.SITE_URL

afterEach(() => {
  jest.restoreAllMocks()
  if (originalSiteUrl === undefined) {
    delete process.env.SITE_URL
  } else {
    process.env.SITE_URL = originalSiteUrl
  }
})

describe('payments checkout status', () => {
  it('keeps existing checkout status available when new payments are disabled', async () => {
    process.env.SITE_URL = 'https://fork.example'
    const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"status":"PENDING"}'))
    const { requestPaymentsCheckoutStatus, requestPaymentsWorker } = await import('@/lib/payments/worker')

    await expect(requestPaymentsWorker('/v1/checkouts', { method: 'POST' })).rejects.toMatchObject({
      code: 'not_configured',
    })

    await expect(
      requestPaymentsCheckoutStatus('123e4567-e89b-12d3-a456-426614174000', 'user-123'),
    ).resolves.toBeInstanceOf(Response)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://payments.kuest.com/v1/checkouts/123e4567-e89b-12d3-a456-426614174000/status')
    expect(init?.method).toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${storedKey}`)
    expect(new Headers(init?.headers).get('X-External-Customer-ID')).toBe('user-123')
  })
})
