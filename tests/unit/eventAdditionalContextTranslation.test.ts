import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestOpenRouterCompletion: vi.fn(),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  requestOpenRouterCompletion: (...args: unknown[]) => mocks.requestOpenRouterCompletion(...args),
}))

const { translateEventAdditionalContext } = await import('@/lib/translations/event-additional-context')

describe('event Additional Context translation', () => {
  beforeEach(() => {
    mocks.requestOpenRouterCompletion.mockReset()
  })

  it('translates dynamic source text for the requested locale', async () => {
    mocks.requestOpenRouterCompletion.mockResolvedValueOnce('  补充背景测试  ')

    await expect(
      translateEventAdditionalContext('This is the additional context testing', 'zh', {
        apiKey: 'test-key',
        model: 'test-model',
      }),
    ).resolves.toBe('补充背景测试')

    expect(mocks.requestOpenRouterCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'This is the additional context testing' }),
      ]),
      expect.objectContaining({ apiKey: 'test-key', model: 'test-model', temperature: 0 }),
    )
  })

  it('rejects an empty provider response', async () => {
    mocks.requestOpenRouterCompletion.mockResolvedValueOnce('   ')

    await expect(translateEventAdditionalContext('Additional context', 'pt', { apiKey: 'test-key' })).rejects.toThrow(
      'empty translation',
    )
  })

  it('allows long contexts to request enough output tokens', async () => {
    mocks.requestOpenRouterCompletion.mockResolvedValueOnce('背景翻译')
    const sourceText = 'a'.repeat(10_000)

    await expect(
      translateEventAdditionalContext(sourceText, 'zh', {
        apiKey: 'test-key',
      }),
    ).resolves.toBe('背景翻译')

    expect(mocks.requestOpenRouterCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxTokens: 8_000 }),
    )
  })
})
