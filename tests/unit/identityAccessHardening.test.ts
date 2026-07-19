import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertIdentityAccess, assertIdentityCollectionEnabled } from '@/lib/identity/access'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: { getSettings: (...args: unknown[]) => mocks.getSettings(...args) },
}))

vi.mock('@/lib/drizzle', () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
  },
}))

function queryResult(value: unknown) {
  const promise = Promise.resolve(value)
  const builder: Record<string, unknown> = {}
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.then = promise.then.bind(promise)
  return builder
}

describe('identity access hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails closed when enforcement settings cannot be loaded', async () => {
    mocks.getSettings.mockResolvedValue({ data: null, error: 'Failed to fetch settings.' })

    await expect(assertIdentityAccess('user-1', 'trade')).rejects.toThrow('IDENTITY_SETTINGS_UNAVAILABLE')
    await expect(assertIdentityCollectionEnabled()).rejects.toThrow('IDENTITY_SETTINGS_UNAVAILABLE')
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('denies a restricted capability while identity erasure is active', async () => {
    mocks.getSettings.mockResolvedValue({
      data: {
        identity: {
          enabled: { value: 'true', updated_at: '2026-07-19T00:00:00.000Z' },
          observe_only: { value: 'false', updated_at: '2026-07-19T00:00:00.000Z' },
        },
      },
      error: null,
    })
    const alwaysAllowedCapabilities = ['browse_public', 'view_account', 'edit_profile', 'cancel_orders', 'claim_or_redeem', 'withdraw']
    const results = [
      [{
        programId: '01H00000000000000000000000',
        accessPolicy: {
          restrictedCapabilities: ['trade'],
          alwaysAllowedCapabilities,
          gracePeriodDays: 0,
          approvalValidityDays: null,
          blockExistingUsers: true,
        },
        assignmentRules: {
          countries: [],
          minimumAge: null,
          maximumAge: null,
          providerConfigId: null,
          fallbackProviderConfigIds: [],
          consent: null,
        },
        publishedAt: null,
      }],
      [{ createdAt: new Date('2026-01-01T00:00:00.000Z') }],
      [],
      [{ id: '01H00000000000000000000001' }],
    ]
    mocks.select.mockImplementation(() => queryResult(results.shift() ?? []))

    await expect(assertIdentityAccess('user-1', 'trade')).rejects.toThrow('IDENTITY_ERASURE_IN_PROGRESS')
  })
})
