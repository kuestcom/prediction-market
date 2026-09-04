import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted, stubGlobal } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  loadOpenRouterProviderSettings: mock(),
  requestOpenRouterCompletion: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
  },
}))

void mock.module('@/lib/ai/market-context-config', () => ({
  loadOpenRouterProviderSettings: (...args: unknown[]) => mocks.loadOpenRouterProviderSettings(...args),
}))

void mock.module('@/lib/ai/openrouter', () => ({
  requestOpenRouterCompletion: (...args: unknown[]) => mocks.requestOpenRouterCompletion(...args),
}))

describe('event creation AI route', () => {
  beforeEach(() => {
    stubGlobal('fetch', mock().mockRejectedValue(new Error('Gamma unavailable')))
    mocks.getCurrentUser.mockReset()
    mocks.loadOpenRouterProviderSettings.mockReset()
    mocks.requestOpenRouterCompletion.mockReset()
  })

  it('keeps generated rules URLs and abbreviations intact when formatting paragraphs', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({ apiKey: 'openrouter-key', model: 'openai/gpt-4o-mini' })
    mocks.requestOpenRouterCompletion.mockResolvedValue(
      JSON.stringify({
        rules: [
          'This market resolves to Yes if CazéTV reaches the stated milestone before the cutoff. For example, e. g. official reporting may include streaming data.',
          'The primary source is https://g1. globo. com/pop-arte/ or another official publisher page on g1. globo. com.',
          'Secondary references may include https://odds. example. xyz/path and status pages on source. app. dev.',
          'The final result. This sentence must stay separated.',
          'If reporting is delayed or revised, the latest available source before resolution should be used.',
        ].join(' '),
      }),
    )

    const { POST } = await import('@/app/[locale]/admin/api/event-creations/ai/route')
    const response = await POST(
      new Request('https://example.com/admin/api/event-creations/ai', {
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
      }),
    )

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

    const generationMessages = mocks.requestOpenRouterCompletion.mock.calls[0]?.[0] as Array<{ content?: string }>
    expect(generationMessages[0]?.content).toContain('MUST always be written in English')
  })

  it('asks the AI content check to flag non-English resolution rules', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mocks.loadOpenRouterProviderSettings.mockResolvedValue({ apiKey: 'openrouter-key', model: 'test-model' })
    mocks.requestOpenRouterCompletion.mockResolvedValueOnce(
      JSON.stringify({
        ok: false,
        errors: [{ code: 'english', reason: 'Resolution rules must be in English.', step: 3 }],
        warnings: [],
      }),
    )

    const { POST } = await import('@/app/[locale]/admin/api/event-creations/ai/route')
    const response = await POST(
      new Request('https://example.com/admin/api/event-creations/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'check_content',
          data: {
            title: 'Will this market resolve?',
            endDateIso: '2026-07-20T00:00:00Z',
            mainCategorySlug: 'politics',
            categories: ['politics', 'government', 'elections', 'world'],
            marketMode: 'binary',
            binaryQuestion: 'Will this market resolve?',
            binaryOutcomeYes: 'Yes',
            binaryOutcomeNo: 'No',
            resolutionRules:
              'Este mercado será resuelto como Sí si la condición se cumple antes de la fecha límite especificada.',
          },
        }),
      }),
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.errors).toContainEqual({
      code: 'english',
      reason: 'Resolution rules must be in English.',
      step: 3,
    })

    const checkMessages = mocks.requestOpenRouterCompletion.mock.calls[0]?.[0] as Array<{ content?: string }>
    expect(checkMessages[0]?.content).toContain('Resolution rules must be written in English')
  })
})
