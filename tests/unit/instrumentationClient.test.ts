import { beforeAll, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  captureRouterTransitionStart: mock(),
  init: mock(),
}))

void mock.module('@sentry/nextjs', () => mocks)

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
