import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertHomeFeaturedNewsMetadataUrlAllowed: vi.fn(),
  fetchHomeFeaturedNewsMetadata: vi.fn(),
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  parseOpenRouterProviderSettings: vi.fn(),
  requestOpenRouterCompletion: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: unknown[]) => mocks.getSettings(...args),
  },
}))

vi.mock('@/lib/ai/market-context-config', () => ({
  parseOpenRouterProviderSettings: (...args: unknown[]) => mocks.parseOpenRouterProviderSettings(...args),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  requestOpenRouterCompletion: (...args: unknown[]) => mocks.requestOpenRouterCompletion(...args),
  sanitizeForPrompt: (value: string) => value,
}))

vi.mock('@/lib/home-featured-context-metadata', () => ({
  assertHomeFeaturedNewsMetadataUrlAllowed: (...args: unknown[]) =>
    mocks.assertHomeFeaturedNewsMetadataUrlAllowed(...args),
  fetchHomeFeaturedNewsMetadata: (...args: unknown[]) => mocks.fetchHomeFeaturedNewsMetadata(...args),
}))

describe('home featured context news route', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.assertHomeFeaturedNewsMetadataUrlAllowed.mockReset()
    mocks.fetchHomeFeaturedNewsMetadata.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getSettings.mockReset()
    mocks.parseOpenRouterProviderSettings.mockReset()
    mocks.requestOpenRouterCompletion.mockReset()
  })

  it('does not return AI fallback URLs when the metadata host validation rejects them', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.parseOpenRouterProviderSettings.mockReturnValue({ apiKey: 'openrouter-key', model: 'openai/gpt-4o-mini' })
    mocks.requestOpenRouterCompletion.mockResolvedValue(JSON.stringify({
      news: [{
        title: 'Blocked Story',
        source: 'Blocked',
        url: 'http://127.0.0.1/admin',
        publishedAt: null,
      }],
    }))
    mocks.fetchHomeFeaturedNewsMetadata.mockRejectedValue(new Error('Could not fetch URL metadata.'))
    mocks.assertHomeFeaturedNewsMetadataUrlAllowed.mockRejectedValue(new Error('URL host is not allowed.'))

    const { POST } = await import('@/app/[locale]/admin/api/home-featured-events/context-news/route')
    const response = await POST(new Request('https://example.com/admin/api/home-featured-events/context-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Brazil vs Norway',
        slug: 'brazil-vs-norway',
        newsSources: '',
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ items: [] })
    expect(mocks.assertHomeFeaturedNewsMetadataUrlAllowed).toHaveBeenCalledWith('http://127.0.0.1/admin')
  })
})
