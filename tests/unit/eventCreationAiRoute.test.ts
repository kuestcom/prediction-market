import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadOpenRouterProviderSettings: vi.fn(),
  requestOpenRouterCompletion: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/ai/market-context-config', () => ({
  loadOpenRouterProviderSettings: (...args: unknown[]) => mocks.loadOpenRouterProviderSettings(...args),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  requestOpenRouterCompletion: (...args: unknown[]) => mocks.requestOpenRouterCompletion(...args),
}))

describe('event creation AI route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Gamma unavailable')))
    mocks.getCurrentUser.mockReset()
    mocks.loadOpenRouterProviderSettings.mockReset()
    mocks.requestOpenRouterCompletion.mockReset()
  })

  it('keeps generated rules URLs and abbreviations intact when formatting paragraphs', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({ apiKey: 'openrouter-key', model: 'openai/gpt-4o-mini' })
    mocks.requestOpenRouterCompletion.mockResolvedValue(JSON.stringify({
      rules: [
        'This market resolves to Yes if CazéTV reaches the stated milestone before the cutoff. For example, e. g. official reporting may include streaming data.',
        'The primary source is https://g1. globo. com/pop-arte/ or another official publisher page on g1. globo. com.',
        'Secondary references may include https://odds. example. xyz/path and status pages on source. app. dev.',
        'The final result. This sentence must stay separated.',
        'If reporting is delayed or revised, the latest available source before resolution should be used.',
      ].join(' '),
    }))

    const { POST } = await import('@/app/[locale]/admin/api/event-creations/ai/route')
    const response = await POST(new Request('https://example.com/admin/api/event-creations/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'generate_rules',
        data: {
          title: 'Will CazéTV hit 40M before Brazil World Cup run ends?',
          endDateIso: '2026-07-20T00:00:00Z',
          mainCategorySlug: 'entertainment',
          marketMode: 'binary',
          binaryQuestion: 'Will CazéTV hit 40M before Brazil World Cup run ends?',
          binaryOutcomeYes: 'Yes',
          binaryOutcomeNo: 'No',
          resolutionSource: 'https://g1.globo.com/pop-arte/',
        },
      }),
    }))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.rules).toContain('e.g.')
    expect(payload.rules).toContain('https://g1.globo.com/pop-arte/')
    expect(payload.rules).toContain('g1.globo.com')
    expect(payload.rules).toContain('https://odds.example.xyz/path')
    expect(payload.rules).toContain('source.app.dev')
    expect(payload.rules).toContain('result. This')
    expect(payload.rules).not.toContain('e. g.')
    expect(payload.rules).not.toContain('g1. globo')
    expect(payload.rules).not.toContain('example. xyz')
    expect(payload.rules).not.toContain('app. dev')
    expect(payload.rules).not.toContain('result.This')
  })
})
