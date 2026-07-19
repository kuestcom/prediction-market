import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSumsubTradingApproval } from '@/lib/sumsub/enforcement'

const mocks = vi.hoisted(() => ({
  getForUser: vi.fn(),
  getSumsubSettings: vi.fn(),
}))

vi.mock('@/lib/db/queries/sumsub', () => ({
  SumsubRepository: { getForUser: mocks.getForUser },
}))

vi.mock('@/lib/sumsub/settings', () => ({
  getSumsubSettings: mocks.getSumsubSettings,
}))

const configured = {
  enabled: true,
  configured: true,
  effective: true,
  levelName: 'basic-kyc-level',
  appToken: 'app',
  secretKey: 'secret',
  webhookSecret: 'webhook',
}

describe('sumsub trading enforcement', () => {
  beforeEach(() => {
    mocks.getForUser.mockReset()
    mocks.getSumsubSettings.mockReset()
  })

  it.each(['disabled', 'observe'] as const)('always allows %s mode', async (enforcement) => {
    mocks.getSumsubSettings.mockResolvedValue({ ...configured, enforcement })
    await expect(requireSumsubTradingApproval('user-1')).resolves.toMatchObject({ allowed: true })
    expect(mocks.getForUser).not.toHaveBeenCalled()
  })

  it('allows Required only for approval on the current level', async () => {
    mocks.getSumsubSettings.mockResolvedValue({ ...configured, enforcement: 'required' })
    mocks.getForUser.mockResolvedValue({ status: 'approved', level_name: 'basic-kyc-level' })
    await expect(requireSumsubTradingApproval('user-1')).resolves.toMatchObject({ allowed: true })

    mocks.getForUser.mockResolvedValue({ status: 'approved', level_name: 'old-level' })
    await expect(requireSumsubTradingApproval('user-1')).resolves.toMatchObject({ allowed: false })
  })

  it.each(['not_started', 'pending', 'on_hold', 'rejected', 'error', 'unknown'])('blocks Required status %s', async (status) => {
    mocks.getSumsubSettings.mockResolvedValue({ ...configured, enforcement: 'required' })
    mocks.getForUser.mockResolvedValue({ status, level_name: 'basic-kyc-level' })
    await expect(requireSumsubTradingApproval('user-1')).resolves.toMatchObject({ allowed: false })
  })

  it('fails closed when settings or status cannot be loaded', async () => {
    mocks.getSumsubSettings.mockRejectedValue(new Error('database unavailable'))
    await expect(requireSumsubTradingApproval('user-1')).resolves.toMatchObject({ allowed: false })
  })
})
