import { describe, expect, it } from 'vitest'
import {
  getCompletedAdminOnboardingTasks,
  getKuestSupportSettings,
  getSupportAnnouncementDismissedAt,
} from '@/lib/admin-support-settings'

describe('admin support settings', () => {
  it('defaults Kuest Support to enabled on the right', () => {
    expect(getKuestSupportSettings()).toEqual({
      enabled: true,
      position: 'right',
    })
  })

  it('parses the enabled state and widget position', () => {
    expect(getKuestSupportSettings({
      integrations: {
        kuest_support_enabled: { value: 'false' },
        kuest_support_position: { value: 'left' },
      },
    })).toEqual({
      enabled: false,
      position: 'left',
    })
  })

  it('combines saved progress with settings that prove a task is complete', () => {
    expect(getCompletedAdminOnboardingTasks({
      admin_onboarding: {
        endpoints: { value: 'true' },
      },
      ai: {
        openrouter_api_key: { value: 'encrypted-key' },
      },
      general: {
        fee_recipient_wallet: { value: '0x1111111111111111111111111111111111111111' },
        site_name: { value: 'Example Market' },
        site_logo_svg: { value: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>' },
      },
    })).toEqual(expect.arrayContaining(['brand', 'fee-wallet', 'openrouter', 'endpoints']))
  })

  it('requires both a custom site name and custom logo to infer brand completion', () => {
    expect(getCompletedAdminOnboardingTasks({
      general: {
        site_name: { value: 'Example Market' },
      },
    })).not.toContain('brand')
    expect(getCompletedAdminOnboardingTasks({
      general: {
        site_logo_image_path: { value: 'logos/custom.png' },
      },
    })).not.toContain('brand')
  })

  it('normalizes a valid announcement dismissal timestamp', () => {
    expect(getSupportAnnouncementDismissedAt({
      admin_support: {
        announcement_dismissed_at: { value: '2026-07-23T15:30:00Z' },
      },
    })).toBe('2026-07-23T15:30:00.000Z')
    expect(getSupportAnnouncementDismissedAt({
      admin_support: {
        announcement_dismissed_at: { value: 'invalid' },
      },
    })).toBeNull()
  })
})
