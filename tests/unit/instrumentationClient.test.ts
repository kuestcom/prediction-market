import { beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => mocks)

describe('client instrumentation', () => {
  let options: any

  beforeAll(async () => {
    await import('@/instrumentation-client')
    options = mocks.init.mock.calls[0]?.[0]
  })

  it('drops Reown SIWE verification errors', () => {
    const error = new Error('Failed to verify message')

    expect(options.beforeSend({}, { originalException: error })).toBeNull()
  })

  it('keeps unrelated errors', () => {
    const error = new Error('Failed to verify transaction')
    const event = {
      exception: {
        values: [{ value: error.message }],
      },
    }

    expect(options.beforeSend(event, { originalException: error })).toBe(event)
  })
})
