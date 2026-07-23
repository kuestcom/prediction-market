import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  revalidatePath: vi.fn(),
  updateSettingMaxValue: vi.fn(),
  updateSettings: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  updateTag: mocks.updateTag,
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: mocks.getSettings,
    updateSettingMaxValue: mocks.updateSettingMaxValue,
    updateSettings: mocks.updateSettings,
  },
}))

describe('admin support actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      address: '0x1111111111111111111111111111111111111111',
      is_admin: true,
    })
    mocks.updateSettingMaxValue.mockResolvedValue({ data: {}, error: null })
  })

  it('updates the announcement watermark with one atomic max-value upsert', async () => {
    const { dismissSupportAnnouncementAction } = await import(
      '@/app/[locale]/admin/_actions/update-admin-support',
    )

    await dismissSupportAnnouncementAction('2026-07-23T15:30:00Z')

    expect(mocks.updateSettingMaxValue).toHaveBeenCalledWith({
      group: 'admin_support',
      key: 'announcement_dismissed_at',
      value: '2026-07-23T15:30:00.000Z',
    })
    expect(mocks.getSettings).not.toHaveBeenCalled()
  })
})
