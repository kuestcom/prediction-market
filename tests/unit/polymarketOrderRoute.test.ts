import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/arbitrage/polymarket-order/route'

const {
  consumeArbitrageOrderQuota,
  getArbitrageOrderQuotaStatus,
  getCurrentUser,
  isActivePolymarketMirrorToken,
  isArbitrageOrderSubmissionEnabled,
} = vi.hoisted(() => ({
  consumeArbitrageOrderQuota: vi.fn(),
  getArbitrageOrderQuotaStatus: vi.fn(),
  getCurrentUser: vi.fn(),
  isActivePolymarketMirrorToken: vi.fn(),
  isArbitrageOrderSubmissionEnabled: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser },
}))

vi.mock('@/lib/arbitrage-order-security', () => ({
  consumeArbitrageOrderQuota,
  getArbitrageOrderQuotaStatus,
  isActivePolymarketMirrorToken,
  isArbitrageOrderSubmissionEnabled,
}))

const polymarketHeaders = {
  POLY_ADDRESS: '0x0000000000000000000000000000000000000001',
  POLY_SIGNATURE: 'signature',
  POLY_TIMESTAMP: '1',
  POLY_API_KEY: 'key',
  POLY_PASSPHRASE: 'passphrase',
}
const orderBody = JSON.stringify({
  deferExec: false,
  postOnly: false,
  order: {
    builder: `0x${'00'.repeat(32)}`,
    expiration: '0',
    maker: '0x0000000000000000000000000000000000000002',
    makerAmount: '4200000',
    metadata: `0x${'00'.repeat(32)}`,
    salt: 123,
    side: 'BUY',
    signature: `0x${'11'.repeat(65)}`,
    signatureType: 0,
    signer: '0x0000000000000000000000000000000000000001',
    takerAmount: '10000000',
    timestamp: '1784102400000',
    tokenId: '123',
  },
  owner: 'key',
  orderType: 'FOK',
})

function createRequest(body: unknown) {
  return new Request('http://localhost/api/arbitrage/polymarket-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('polymarket order proxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    getCurrentUser.mockReset()
    consumeArbitrageOrderQuota.mockReset()
    getArbitrageOrderQuotaStatus.mockReset()
    isActivePolymarketMirrorToken.mockReset()
    isArbitrageOrderSubmissionEnabled.mockReset()
    consumeArbitrageOrderQuota.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
    getArbitrageOrderQuotaStatus.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
    isActivePolymarketMirrorToken.mockResolvedValue(true)
    isArbitrageOrderSubmissionEnabled.mockResolvedValue(true)
  })

  it('preflights server readiness before either arbitrage leg is submitted', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })

    const response = await GET(new Request(
      'http://localhost/api/arbitrage/polymarket-order?tokenId=123',
    ))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ready: true })
    expect(getArbitrageOrderQuotaStatus).toHaveBeenCalledWith('user-id')
    expect(isActivePolymarketMirrorToken).toHaveBeenCalledWith('123')
  })

  it('fails preflight safely when the rate-limit migration has not been applied', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    getArbitrageOrderQuotaStatus.mockRejectedValue(new Error('relation does not exist'))

    const response = await GET(new Request(
      'http://localhost/api/arbitrage/polymarket-order?tokenId=123',
    ))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Polymarket order service is temporarily unavailable.',
    })
  })

  it('requires an authenticated site user', async () => {
    getCurrentUser.mockResolvedValue(null)

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(401)
  })

  it('always returns JSON for unexpected proxy failures', async () => {
    getCurrentUser.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      error: 'Polymarket order service is temporarily unavailable.',
    })
  })

  it('rejects requests that are not FOK Polymarket orders', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })

    const response = await POST(createRequest({
      headers: polymarketHeaders,
      body: JSON.stringify({ orderType: 'GTC' }),
    }))

    expect(response.status).toBe(400)
  })

  it('rejects signed bodies whose signer does not match the L2 authentication headers', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    const mismatchedOrder = JSON.parse(orderBody)
    mismatchedOrder.order.signer = '0x0000000000000000000000000000000000000003'

    const response = await POST(createRequest({
      headers: polymarketHeaders,
      body: JSON.stringify(mismatchedOrder),
    }))

    expect(response.status).toBe(400)
    expect(consumeArbitrageOrderQuota).not.toHaveBeenCalled()
  })

  it('accepts the legacy order shape used by V1 markets', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    const legacyOrder = JSON.parse(orderBody)
    delete legacyOrder.order.builder
    delete legacyOrder.order.metadata
    delete legacyOrder.order.timestamp
    Object.assign(legacyOrder.order, {
      expiration: '0',
      feeRateBps: '0',
      nonce: '0',
      taker: '0x0000000000000000000000000000000000000000',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))

    const response = await POST(createRequest({
      headers: polymarketHeaders,
      body: JSON.stringify(legacyOrder),
    }))

    expect(response.status).toBe(200)
  })

  it('allows EIP-1271 orders whose contract signer differs from the L2 owner', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    const contractOrder = JSON.parse(orderBody)
    contractOrder.order.signatureType = 3
    contractOrder.order.signer = contractOrder.order.maker
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))

    const response = await POST(createRequest({
      headers: polymarketHeaders,
      body: JSON.stringify(contractOrder),
    }))

    expect(response.status).toBe(200)
  })

  it('rejects direct submissions when arbitrage is disabled', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    isArbitrageOrderSubmissionEnabled.mockResolvedValue(false)

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(403)
    expect(consumeArbitrageOrderQuota).not.toHaveBeenCalled()
  })

  it('rejects tokens that do not belong to an active mirrored market', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    isActivePolymarketMirrorToken.mockResolvedValue(false)

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(403)
    expect(isActivePolymarketMirrorToken).toHaveBeenCalledWith('123')
  })

  it('rate limits repeated order submissions per authenticated user', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    consumeArbitrageOrderQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 })

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(isActivePolymarketMirrorToken).not.toHaveBeenCalled()
  })

  it('returns JSON when the persistent rate-limit storage is unavailable', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    consumeArbitrageOrderQuota.mockRejectedValue(new Error('relation does not exist'))

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      error: 'Polymarket order service is temporarily unavailable.',
    })
  })

  it('forwards the exact signed body and authentication headers from the client', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-id' })
    const upstreamResponse = {
      success: true,
      orderID: 'order-id',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify(upstreamResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))

    const response = await POST(createRequest({ headers: polymarketHeaders, body: orderBody }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(upstreamResponse)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://clob.polymarket.com/order',
      expect.objectContaining({
        method: 'POST',
        body: orderBody,
        headers: expect.objectContaining(polymarketHeaders),
      }),
    )
    expect(consumeArbitrageOrderQuota).toHaveBeenCalledWith('user-id')
    expect(isActivePolymarketMirrorToken).toHaveBeenCalledWith('123')
  })
})
