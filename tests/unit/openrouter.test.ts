import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadRuntimeThemeSiteName: vi.fn(),
}))

vi.mock('@/lib/theme-settings', () => ({
  loadRuntimeThemeSiteName: (...args: any[]) => mocks.loadRuntimeThemeSiteName(...args),
}))

describe('openrouter helpers', () => {
  const originalSiteUrl = process.env.SITE_URL

  beforeEach(() => {
    vi.resetModules()
    mocks.loadRuntimeThemeSiteName.mockReset()
    process.env.SITE_URL = 'https://kuest.test'
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    }
    else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

  it('sends runtime site name in completion headers', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: ' hello world ' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { requestOpenRouterCompletion } = await import('@/lib/ai/openrouter')
    const content = await requestOpenRouterCompletion(
      [{ role: 'user', content: 'hello' }],
      { apiKey: 'openrouter-key', model: 'openai/gpt-4o-mini' },
    )

    expect(content).toBe('hello world')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer openrouter-key')
    expect(headers['HTTP-Referer']).toBe('https://kuest.test')
    expect(headers['X-Title']).toBe('Kuest Runtime')
  })

  it('sends runtime site name in models headers', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { fetchOpenRouterModels } = await import('@/lib/ai/openrouter')
    const models = await fetchOpenRouterModels('openrouter-key')

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o mini',
      contextLength: 128000,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer openrouter-key')
    expect(headers['HTTP-Referer']).toBe('https://kuest.test')
    expect(headers['X-Title']).toBe('Kuest Runtime')
  })
})
