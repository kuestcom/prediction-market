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
  })

  it('uses settings theme when DB values are valid', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          preset: { value: 'lime', updated_at: '2026-01-01T00:00:00.000Z' },
          light_json: { value: '{"primary":"#112233"}', updated_at: '2026-01-01T00:00:00.000Z' },
          dark_json: { value: '{"primary":"#445566"}', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('settings')
    expect(state.theme.presetId).toBe('lime')
    expect(state.theme.light.primary).toBe('#112233')
    expect(state.theme.dark.primary).toBe('#445566')
  })

  it('falls back when stored settings are invalid', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          preset: { value: 'lime', updated_at: '2026-01-01T00:00:00.000Z' },
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
  })

  it('uses default theme when there are no stored settings', async () => {
    mocks.getSettings.mockResolvedValueOnce({ data: {}, error: null })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('default')
    expect(state.theme.presetId).toBe('default')
  })

  it('maps legacy kuest preset from settings to default', async () => {
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        theme: {
          preset: { value: 'kuest', updated_at: '2026-01-01T00:00:00.000Z' },
          light_json: { value: '{}', updated_at: '2026-01-01T00:00:00.000Z' },
          dark_json: { value: '{}', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })

    const { loadRuntimeThemeState } = await import('@/lib/theme-settings')
    const state = await loadRuntimeThemeState()

    expect(state.source).toBe('settings')
    expect(state.theme.presetId).toBe('default')
  })
})
