import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildResolutionReportMessage } from '@/lib/resolution-report'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTarget: vi.fn(),
  isEligible: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/db/queries/resolution-report', () => ({
  ResolutionReportRepository: {
    getTarget: mocks.getTarget,
    upsert: mocks.upsert,
  },
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: mocks.getCurrentUser,
  },
}))

vi.mock('@/lib/resolution-report-eligibility', () => ({
  isEligibleToReportResolution: mocks.isEligible,
}))

describe('resolution report route', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getCurrentUser.mockReset()
    mocks.getTarget.mockReset()
    mocks.isEligible.mockReset()
    mocks.upsert.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a conflict when an older or replayed proposal loses the atomic upsert', async () => {
    const account = privateKeyToAccount(`0x${'11'.repeat(32)}`)
    const issuedAt = new Date().toISOString()
    const payload = {
      conditionId: 'condition-1',
      eventId: '01K3EVENT00000000000000000',
      issuedAt,
      nonce: '12345678-1234-4123-8123-123456789abc',
      outcome: 'yes' as const,
      reporterAddress: account.address,
    }
    const signature = await account.signMessage({ message: buildResolutionReportMessage(payload) })

    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: account.address,
      deposit_wallet_address: account.address,
    })
    mocks.getTarget.mockResolvedValue({
      conditionId: payload.conditionId,
      eventId: payload.eventId,
      eventStatus: 'active',
      marketActive: true,
      marketResolved: false,
      conditionResolved: false,
      negRisk: false,
      resolver: null,
      oracle: '0x1111111111111111111111111111111111111111',
      metadata: JSON.stringify({ resolution_type: 'dro_moov2' }),
    })
    mocks.isEligible.mockResolvedValue(true)
    mocks.upsert.mockResolvedValue(null)

    const { POST } = await import('@/app/api/resolution-reports/route')
    const response = await POST(
      new Request('https://example.test/api/resolution-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, signature }),
      }) as never,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'stale_report' })
  })
})
