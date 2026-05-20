import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  upsertSettingsWithUpdatedAt: vi.fn(),
  touchSettings: vi.fn(),
  deleteSettings: vi.fn(),
  syncBuilderFeesForAdmin: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
    updateSettings: (...args: any[]) => mocks.updateSettings(...args),
    upsertSettingsWithUpdatedAt: (...args: any[]) => mocks.upsertSettingsWithUpdatedAt(...args),
    touchSettings: (...args: any[]) => mocks.touchSettings(...args),
    deleteSettings: (...args: any[]) => mocks.deleteSettings(...args),
  },
}))

vi.mock('@/lib/affiliate-fee-sync', () => ({
  syncBuilderFeesForAdmin: (...args: any[]) => mocks.syncBuilderFeesForAdmin(...args),
}))

describe('updateForkSettingsAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getSettings.mockReset()
    mocks.updateSettings.mockReset()
    mocks.upsertSettingsWithUpdatedAt.mockReset()
    mocks.touchSettings.mockReset()
    mocks.deleteSettings.mockReset()
    mocks.syncBuilderFeesForAdmin.mockReset()
    mocks.upsertSettingsWithUpdatedAt.mockResolvedValue({ data: [], error: null })
    mocks.touchSettings.mockResolvedValue({ data: [], error: null })
    mocks.deleteSettings.mockResolvedValue({ data: [], error: null })
    mocks.syncBuilderFeesForAdmin.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateForkSettingsAction } = await import('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings')
    const result = await updateForkSettingsAction({ error: null }, new FormData())

    expect(result).toEqual({ error: 'Unauthenticated.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('validates the fee recipient wallet', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
      deposit_wallet_address: '0x1111111111111111111111111111111111111111',
      is_admin: true,
    })

    const { updateForkSettingsAction } = await import('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings')
    const formData = new FormData()
    formData.set('builder_taker_fee_percent', '2')
    formData.set('builder_maker_fee_percent', '1')
    formData.set('affiliate_share_percent', '10')
    formData.set('fee_recipient_wallet', 'not-a-wallet')

    const result = await updateForkSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: 'Fee recipient wallet must be a valid wallet address.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('saves affiliate fees and fee recipient wallet together', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
      deposit_wallet_address: '0x1111111111111111111111111111111111111111',
      is_admin: true,
    })
    mocks.getSettings.mockResolvedValueOnce({ data: {}, error: null })

    const { updateForkSettingsAction } = await import('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings')
    const formData = new FormData()
    formData.set('builder_taker_fee_percent', '2.5')
    formData.set('builder_maker_fee_percent', '1.25')
    formData.set('affiliate_share_percent', '15.5')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')

    const result = await updateForkSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
    expect(mocks.upsertSettingsWithUpdatedAt).toHaveBeenCalledTimes(1)
    expect(mocks.syncBuilderFeesForAdmin).toHaveBeenCalledWith({
      id: 'admin-1',
      address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    })
    expect(mocks.touchSettings).toHaveBeenCalledTimes(1)

    const stagedPayload = mocks.upsertSettingsWithUpdatedAt.mock.calls[0][0] as Array<{
      group: string
      key: string
      value: string
      updated_at: Date
    }>
    expect(stagedPayload).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: 'affiliate', key: 'builder_taker_fee_bps', value: '250', updated_at: expect.any(Date) }),
      expect.objectContaining({ group: 'affiliate', key: 'builder_maker_fee_bps', value: '125', updated_at: expect.any(Date) }),
      expect.objectContaining({ group: 'affiliate', key: 'affiliate_share_bps', value: '1550', updated_at: expect.any(Date) }),
      expect.objectContaining({ group: 'general', key: 'fee_recipient_wallet', value: '0x1111111111111111111111111111111111111111', updated_at: expect.any(Date) }),
    ]))

    expect(mocks.touchSettings.mock.calls[0][0]).toEqual([
      { group: 'affiliate', key: 'builder_taker_fee_bps' },
      { group: 'affiliate', key: 'builder_maker_fee_bps' },
      { group: 'affiliate', key: 'affiliate_share_bps' },
      { group: 'general', key: 'fee_recipient_wallet' },
    ])
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/affiliate')
  })

  it('syncs only the wallet when fee values are unchanged', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      deposit_wallet_address: '0x2222222222222222222222222222222222222222',
      is_admin: true,
    })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        affiliate: {
          builder_taker_fee_bps: { value: '250', updated_at: '2026-05-01T00:00:00.000Z' },
          builder_maker_fee_bps: { value: '125', updated_at: '2026-05-01T00:00:00.000Z' },
          affiliate_share_bps: { value: '1550', updated_at: '2026-05-01T00:00:00.000Z' },
        },
        general: {
          fee_recipient_wallet: {
            value: '0x1111111111111111111111111111111111111111',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        },
      },
      error: null,
    })

    const { updateForkSettingsAction } = await import('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings')
    const formData = new FormData()
    formData.set('builder_taker_fee_percent', '2.5')
    formData.set('builder_maker_fee_percent', '1.25')
    formData.set('affiliate_share_percent', '15.5')
    formData.set('fee_recipient_wallet', '0x2222222222222222222222222222222222222222')

    const result = await updateForkSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
    expect(mocks.upsertSettingsWithUpdatedAt).toHaveBeenCalledTimes(1)
    expect(mocks.upsertSettingsWithUpdatedAt.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        group: 'general',
        key: 'fee_recipient_wallet',
        value: '0x2222222222222222222222222222222222222222',
        updated_at: expect.any(Date),
      }),
    ])
    expect(mocks.touchSettings).toHaveBeenCalledWith([
      { group: 'general', key: 'fee_recipient_wallet' },
    ], expect.any(Date))
    expect(mocks.syncBuilderFeesForAdmin).toHaveBeenCalledWith({
      id: 'admin-1',
      address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    })
  })

  it('repairs a missing affiliate share setting row even when the submitted value matches the default', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
      deposit_wallet_address: '0x1111111111111111111111111111111111111111',
      is_admin: true,
    })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        affiliate: {
          builder_taker_fee_bps: { value: '100', updated_at: '2026-05-01T00:00:00.000Z' },
          builder_maker_fee_bps: { value: '0', updated_at: '2026-05-01T00:00:00.000Z' },
        },
        general: {
          fee_recipient_wallet: {
            value: '0x1111111111111111111111111111111111111111',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        },
      },
      error: null,
    })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateForkSettingsAction } = await import('@/app/[locale]/admin/affiliate/_actions/update-affiliate-settings')
    const formData = new FormData()
    formData.set('builder_taker_fee_percent', '1')
    formData.set('builder_maker_fee_percent', '0')
    formData.set('affiliate_share_percent', '50')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')

    const result = await updateForkSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)
    expect(mocks.updateSettings.mock.calls[0][0]).toEqual([
      { group: 'affiliate', key: 'affiliate_share_bps', value: '5000' },
    ])
    expect(mocks.syncBuilderFeesForAdmin).not.toHaveBeenCalled()
    expect(mocks.upsertSettingsWithUpdatedAt).not.toHaveBeenCalled()
  })
})
