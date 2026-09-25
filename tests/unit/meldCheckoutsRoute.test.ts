import { afterEach, describe, expect, it, mock } from 'bun:test'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  requestPaymentsWorker: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: mocks.getCurrentUser },
}))

void mock.module('@/lib/payments/worker', () => ({
  PAYMENTS_WORKER_ORIGIN: 'https://payments.kuest.com',
  PaymentsWorkerRequestError: class PaymentsWorkerRequestError extends Error {
    constructor(readonly code: 'not_configured' | 'unavailable') {
      super(code)
    }
  },
  requestPaymentsWorker: mocks.requestPaymentsWorker,
}))

afterEach(() => mock.clearAllMocks())

describe('Meld checkout route', () => {
  it('does not forward caller-controlled X-Forwarded-For to the Worker', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-123',
      deposit_wallet_address: '0x1111111111111111111111111111111111111111',
      deposit_wallet_status: 'deployed',
    })
    mocks.requestPaymentsWorker.mockResolvedValue(
      new Response(
        JSON.stringify({
          checkoutId: '123e4567-e89b-12d3-a456-426614174000',
          launchUrl: `https://payments.kuest.com/launch/${'L'.repeat(43)}`,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const { POST } = await import('@/app/api/payments/meld/checkouts/route')

    const response = await POST(
      new Request('https://fork.example/api/payments/meld/checkouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://fork.example',
          'X-Forwarded-For': '203.0.113.42, 198.51.100.10',
        },
        body: JSON.stringify({ quoteId: '123e4567-e89b-12d3-a456-426614174001' }),
      }),
    )

    expect(response.status).toBe(201)
    const [path, init] = mocks.requestPaymentsWorker.mock.calls[0]!
    expect(path).toBe('/v1/checkouts')
    const workerPayload: unknown = JSON.parse(String(init?.body))
    expect(workerPayload).toEqual({
      quoteId: '123e4567-e89b-12d3-a456-426614174001',
      externalCustomerId: 'user-123',
      walletAddress: '0x1111111111111111111111111111111111111111',
    })
  })
})
