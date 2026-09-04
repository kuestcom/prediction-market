import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { hoisted, stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  loadRuntimeThemeSiteName: mock(),
}))

void mock.module('@/lib/theme-settings', () => ({
  loadRuntimeThemeSiteName: (...args: any[]) => mocks.loadRuntimeThemeSiteName(...args),
}))

describe('openrouter helpers', () => {
  const originalSiteUrl = process.env.SITE_URL

  beforeEach(() => {
    mocks.loadRuntimeThemeSiteName.mockReset()
    process.env.SITE_URL = 'https://kuest.test'
  })

  afterEach(() => {
    unstubAllGlobals()

    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL
    } else {
      process.env.SITE_URL = originalSiteUrl
    }
  })

  it('sends runtime site name in completion headers', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
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
    const content = await requestOpenRouterCompletion([{ role: 'user', content: 'hello' }], {
      apiKey: 'openrouter-key',
      model: 'openai/gpt-4o-mini',
    })

    expect(content).toBe('hello world')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer openrouter-key')
    expect(headers['HTTP-Referer']).toBe('https://kuest.test')
    expect(headers['X-OpenRouter-Title']).toBe('Kuest Runtime')
  })

  it('rejects completions truncated by the max token limit', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'length',
              message: { role: 'assistant', content: 'partial translation' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { requestOpenRouterCompletion } = await import('@/lib/ai/openrouter')
    await expect(
      requestOpenRouterCompletion([{ role: 'user', content: 'hello' }], {
        apiKey: 'openrouter-key',
        model: 'openai/gpt-4o-mini',
      }),
    ).rejects.toThrow('truncated')
  })

  it('loads only web-search-capable models and sends runtime site name in models headers', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-4o-mini',
              name: 'GPT-4o mini',
              context_length: 128000,
              supported_parameters: ['max_tokens', 'web_search_options'],
            },
            {
              id: 'anthropic/claude-sonnet',
              name: 'Claude Sonnet',
              context_length: 200000,
              supported_parameters: ['max_tokens'],
            },
            {
              id: 'perplexity/sonar',
              name: 'Sonar',
              context_window: 127000,
              supported_parameters: ['temperature', 'web_search_options'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { fetchOpenRouterModels } = await import('@/lib/ai/openrouter')
    const models = await fetchOpenRouterModels('openrouter-key')

    expect(models).toEqual([
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o mini',
        contextLength: 128000,
      },
      {
        id: 'perplexity/sonar',
        name: 'Sonar',
        contextLength: 127000,
      },
    ])

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer openrouter-key')
    expect(headers['HTTP-Referer']).toBe('https://kuest.test')
    expect(headers['X-OpenRouter-Title']).toBe('Kuest Runtime')
  })

  it('loads all available models for translation selection', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'anthropic/claude-sonnet',
              name: 'Claude Sonnet',
              supported_parameters: ['max_tokens'],
            },
            {
              id: 'openai/gpt-4o-mini',
              name: 'GPT-4o mini',
              supported_parameters: ['max_tokens', 'web_search_options'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { fetchAllOpenRouterModels } = await import('@/lib/ai/openrouter')
    await expect(fetchAllOpenRouterModels('openrouter-key')).resolves.toEqual([
      {
        id: 'anthropic/claude-sonnet',
        name: 'Claude Sonnet',
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4o mini',
      },
    ])
  })

  it('shares the in-flight models response between both projections', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('Kuest Runtime')

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'openai/gpt-4o-mini',
              name: 'GPT-4o mini',
              supported_parameters: ['web_search_options'],
            },
            {
              id: 'anthropic/claude-sonnet',
              name: 'Claude Sonnet',
              supported_parameters: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { fetchAllOpenRouterModels, fetchOpenRouterModels } = await import('@/lib/ai/openrouter')
    const [webSearchModels, allModels] = await Promise.all([
      fetchOpenRouterModels('openrouter-key'),
      fetchAllOpenRouterModels('openrouter-key'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(webSearchModels.map((model) => model.id)).toEqual(['openai/gpt-4o-mini'])
    expect(allModels.map((model) => model.id)).toEqual(['anthropic/claude-sonnet', 'openai/gpt-4o-mini'])
  })

  it('omits incompatible characters from the runtime site title header', async () => {
    const fetchMock = mock()
    stubGlobal('fetch', fetchMock)
    mocks.loadRuntimeThemeSiteName.mockResolvedValueOnce('测试站点名称')

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { fetchAllOpenRouterModels } = await import('@/lib/ai/openrouter')
    await expect(fetchAllOpenRouterModels('openrouter-key')).resolves.toEqual([])

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-OpenRouter-Title']).toBeUndefined()
  })
})
