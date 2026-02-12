import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptSecret: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decryptSecret: (...args: any[]) => mocks.decryptSecret(...args),
}))

function setting(value: string) {
  return {
    value,
    updated_at: '2026-02-12T00:00:00.000Z',
  }
}

describe('market context settings parser', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.decryptSecret.mockReset()
    mocks.decryptSecret.mockImplementation((value: string) => value.replace(/^enc\.v1\./, ''))
  })

  it('reads market context enabled flag from market_context_enabled', async () => {
    const { parseMarketContextSettings } = await import('@/lib/ai/market-context-config')

    const parsed = parseMarketContextSettings({
      ai: {
        market_context_enabled: setting('true'),
      },
    })

    expect(parsed.enabled).toBe(true)
  })

  it('defaults market context to enabled when key is missing even if OpenRouter is configured', async () => {
    const { parseMarketContextSettings } = await import('@/lib/ai/market-context-config')

    const parsed = parseMarketContextSettings({
      ai: {
        openrouter_api_key: setting('enc.v1.openrouter-key'),
      },
    })

    expect(parsed.apiKey).toBe('openrouter-key')
    expect(parsed.enabled).toBe(true)
  })

  it('prioritizes market_context_enabled over legacy openrouter_enabled value', async () => {
    const { parseMarketContextSettings } = await import('@/lib/ai/market-context-config')

    const parsed = parseMarketContextSettings({
      ai: {
        market_context_enabled: setting('false'),
        openrouter_enabled: setting('true'),
      },
    })

    expect(parsed.enabled).toBe(false)
  })
})
