import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLocale: vi.fn(),
  loadMarketContextSettings: vi.fn(),
  getEventBySlug: vi.fn(),
  generateMarketContext: vi.fn(),
  getValidContext: vi.fn(),
  upsertContext: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mocks.getLocale,
}))

vi.mock('@/lib/ai/market-context-config', () => ({
  loadMarketContextSettings: mocks.loadMarketContextSettings,
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    getEventBySlug: (...args: any[]) => mocks.getEventBySlug(...args),
  },
}))

vi.mock('@/lib/ai/market-context', () => ({
  generateMarketContext: (...args: any[]) => mocks.generateMarketContext(...args),
}))

vi.mock('@/lib/db/queries/market-context-cache', () => ({
  MarketContextCacheRepository: {
    getValidContext: (...args: any[]) => mocks.getValidContext(...args),
    upsertContext: (...args: any[]) => mocks.upsertContext(...args),
  },
}))

function mockConfiguredSettings() {
  mocks.loadMarketContextSettings.mockResolvedValue({
    enabled: true,
    apiKey: 'api-key',
    model: 'test-model',
    prompt: 'prompt',
  })
}

function makeEvent() {
  return {
    slug: 'event-slug',
    markets: [{ condition_id: 'condition-1' }],
  } as any
}

describe('generateMarketContextAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getLocale.mockReset()
    mocks.loadMarketContextSettings.mockReset()
    mocks.getEventBySlug.mockReset()
    mocks.generateMarketContext.mockReset()
    mocks.getValidContext.mockReset()
    mocks.upsertContext.mockReset()

    mocks.getLocale.mockResolvedValue('en')
  })

  it('returns cached context when a valid cache entry exists', async () => {
    mockConfiguredSettings()
    mocks.getEventBySlug.mockResolvedValue({ data: makeEvent(), error: null })
    mocks.getValidContext.mockResolvedValue({
      data: {
        context: 'cached market summary',
        expiresAt: '2026-04-06T15:00:00.000Z',
        updatedAt: '2026-04-06T14:30:00.000Z',
      },
      error: null,
    })

    const { generateMarketContextAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/generate-market-context')

    const result = await generateMarketContextAction({
      slug: 'event-slug',
      marketConditionId: 'condition-1',
    })

    expect(result).toEqual({
      context: 'cached market summary',
      expiresAt: '2026-04-06T15:00:00.000Z',
      updatedAt: '2026-04-06T14:30:00.000Z',
      cached: true,
    })
    expect(mocks.generateMarketContext).not.toHaveBeenCalled()
    expect(mocks.upsertContext).not.toHaveBeenCalled()
  })

  it('does not generate when readOnly is true and no cache entry exists, even without generation settings', async () => {
    mocks.getEventBySlug.mockResolvedValue({ data: makeEvent(), error: null })
    mocks.getValidContext.mockResolvedValue({ data: null, error: null })

    const { generateMarketContextAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/generate-market-context')

    const result = await generateMarketContextAction({
      slug: 'event-slug',
      marketConditionId: 'condition-1',
      readOnly: true,
    })

    expect(result).toEqual({
      context: null,
      expiresAt: null,
      updatedAt: null,
      cached: false,
    })
    expect(mocks.generateMarketContext).not.toHaveBeenCalled()
    expect(mocks.upsertContext).not.toHaveBeenCalled()
    expect(mocks.loadMarketContextSettings).not.toHaveBeenCalled()
  })

  it('generates and persists a new cache entry when cache is missing', async () => {
    mockConfiguredSettings()
    mocks.getEventBySlug.mockResolvedValue({ data: makeEvent(), error: null })
    mocks.getValidContext.mockResolvedValue({ data: null, error: null })
    mocks.generateMarketContext.mockResolvedValue('fresh market summary')
    mocks.upsertContext.mockResolvedValue({
      data: {
        context: 'fresh market summary',
        expiresAt: '2026-04-06T15:30:00.000Z',
        updatedAt: '2026-04-06T15:00:00.000Z',
      },
      error: null,
    })

    const { generateMarketContextAction } = await import('@/app/[locale]/(platform)/event/[slug]/_actions/generate-market-context')

    const result = await generateMarketContextAction({
      slug: 'event-slug',
      marketConditionId: 'condition-1',
    })

    expect(result).toEqual({
      context: 'fresh market summary',
      expiresAt: '2026-04-06T15:30:00.000Z',
      updatedAt: '2026-04-06T15:00:00.000Z',
      cached: false,
    })
    expect(mocks.upsertContext).toHaveBeenCalledWith(
      'condition-1',
      'en',
      'fresh market summary',
      expect.any(Date),
    )
  })
})
