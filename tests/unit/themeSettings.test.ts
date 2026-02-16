import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: { getSettings: (...args: any[]) => mocks.getSettings(...args) },
}))

describe('theme settings runtime resolver', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getSettings.mockReset()
  })

  it('uses default fallback when DB read fails', async () => {
    mocks.getSettings.mockResolvedValueOnce({ data: null, error: 'Failed to fetch settings.' })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('default')
    expect(state.theme.presetId).toBe('default')
    expect(state.theme.radius).toBeNull()
    expect(state.site.name).toBeTruthy()
    expect(state.site.description).toBeTruthy()
    expect(state.site.logoSvg).toContain('<svg')
  })

  it('uses settings theme when DB values are valid', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          preset: { value: 'lime', updated_at: '2026-01-01T00:00:00.000Z' },
          radius: { value: '12px', updated_at: '2026-01-01T00:00:00.000Z' },
          light_json: { value: '{"primary":"#112233"}', updated_at: '2026-01-01T00:00:00.000Z' },
          dark_json: { value: '{"primary":"#445566"}', updated_at: '2026-01-01T00:00:00.000Z' },
        },
        general: {
          site_name: { value: 'Kuest Lime', updated_at: '2026-01-01T00:00:00.000Z' },
          site_description: { value: 'Lime branded market', updated_at: '2026-01-01T00:00:00.000Z' },
          site_logo_mode: { value: 'svg', updated_at: '2026-01-01T00:00:00.000Z' },
          site_logo_svg: { value: '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>', updated_at: '2026-01-01T00:00:00.000Z' },
          pwa_icon_192_path: { value: 'theme/pwa-192.png', updated_at: '2026-01-01T00:00:00.000Z' },
          pwa_icon_512_path: { value: 'theme/pwa-512.png', updated_at: '2026-01-01T00:00:00.000Z' },
          site_google_analytics: { value: 'G-TEST123', updated_at: '2026-01-01T00:00:00.000Z' },
          site_discord_link: { value: 'https://discord.gg/kuest', updated_at: '2026-01-01T00:00:00.000Z' },
          site_support_url: { value: 'https://kuest.com/support', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('settings')
    expect(state.theme.presetId).toBe('lime')
    expect(state.theme.radius).toBe('12px')
    expect(state.theme.light.primary).toBe('#112233')
    expect(state.theme.dark.primary).toBe('#445566')
    expect(state.theme.cssText).toContain('--radius: 12px;')
    expect(state.site.name).toBe('Kuest Lime')
    expect(state.site.description).toBe('Lime branded market')
    expect(state.site.logoMode).toBe('svg')
    expect(state.site.googleAnalyticsId).toBe('G-TEST123')
    expect(state.site.discordLink).toBe('https://discord.gg/kuest')
    expect(state.site.supportUrl).toBe('https://kuest.com/support')
    expect(state.site.pwaIcon192Url).toContain('theme/pwa-192.png')
    expect(state.site.pwaIcon512Url).toContain('theme/pwa-512.png')
  })

  it('falls back when stored settings are invalid', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          preset: { value: 'lime', updated_at: '2026-01-01T00:00:00.000Z' },
          radius: { value: 'invalid', updated_at: '2026-01-01T00:00:00.000Z' },
          light_json: { value: '{"bad-token":"#112233"}', updated_at: '2026-01-01T00:00:00.000Z' },
          dark_json: { value: '{}', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('default')
    expect(state.theme.presetId).toBe('default')
    expect(state.theme.radius).toBeNull()
    expect(state.site.name).toBeTruthy()
    expect(state.site.description).toBeTruthy()
  })

  it('uses default theme when there are no stored settings', async () => {
    mocks.getSettings.mockResolvedValueOnce({ data: {}, error: null })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('default')
    expect(state.theme.presetId).toBe('default')
    expect(state.theme.radius).toBeNull()
    expect(state.site.name).toBeTruthy()
    expect(state.site.description).toBeTruthy()
  })

  it('does not read site identity from theme group', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          site_name: { value: 'Legacy Theme Name', updated_at: '2026-01-01T00:00:00.000Z' },
          site_description: { value: 'Legacy Theme Description', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.site.name).not.toBe('Legacy Theme Name')
    expect(state.site.description).not.toBe('Legacy Theme Description')
  })
})
