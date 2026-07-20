import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/sumsub/route'

const mocks = vi.hoisted(() => ({
  getSumsubSettings: vi.fn(),
  processWebhook: vi.fn(),
}))

vi.mock('@/lib/sumsub/settings', () => ({ getSumsubSettings: mocks.getSumsubSettings }))
vi.mock('@/lib/db/queries/sumsub', () => ({ SumsubRepository: { processWebhook: mocks.processWebhook } }))

const payload = {
  applicantId: 'applicant-1',
  externalUserId: 'kuest:user-1',
  levelName: 'basic-kyc-level',
  type: 'applicantReviewed',
  createdAtMs: '2026-04-30 08:04:23.379',
  reviewStatus: 'completed',
  reviewResult: { reviewAnswer: 'GREEN' },
}

function request(body: string, algorithm = 'HMAC_SHA256_HEX', secret = 'webhook-secret') {
  const hash = algorithm === 'HMAC_SHA512_HEX' ? 'sha512' : 'sha256'
  return new Request('http://localhost/api/webhooks/sumsub', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payload-Digest-Alg': algorithm,
      'X-Payload-Digest': createHmac(hash, secret).update(body).digest('hex'),
    },
    body,
  })
}

describe('sumsub webhook', () => {
  beforeEach(() => {
    mocks.getSumsubSettings.mockReset().mockResolvedValue({ webhookSecret: 'webhook-secret' })
    mocks.processWebhook.mockReset().mockResolvedValue({ duplicate: false, updated: true })
  })

  it.each(['HMAC_SHA256_HEX', 'HMAC_SHA512_HEX'])('accepts a valid %s signature', async (algorithm) => {
    const response = await POST(request(JSON.stringify(payload), algorithm))
    expect(response.status).toBe(200)
    expect(mocks.processWebhook).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      applicantId: 'applicant-1',
      externalUserId: 'kuest:user-1',
      levelName: 'basic-kyc-level',
      status: 'approved',
    }), 'applicantReviewed')
  })

  it('rejects an invalid or altered payload before processing', async () => {
    const original = JSON.stringify(payload)
    const altered = `${original} `
    const invalid = request(original)
    const response = await POST(new Request(invalid.url, { method: 'POST', headers: invalid.headers, body: altered }))
    expect(response.status).toBe(401)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it('rejects unsupported algorithms', async () => {
    const response = await POST(request(JSON.stringify(payload), 'HMAC_SHA1_HEX'))
    expect(response.status).toBe(401)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it('returns success for a deduplicated delivery', async () => {
    mocks.processWebhook.mockResolvedValue({ duplicate: true, updated: false })
    expect((await POST(request(JSON.stringify(payload)))).status).toBe(200)
  })

  it('does not accept a mismatched applicant association', async () => {
    mocks.processWebhook.mockRejectedValue(new Error('association mismatch'))
    expect((await POST(request(JSON.stringify(payload)))).status).toBe(409)
  })

  it('rejects invalid JSON and unknown event types after signature validation', async () => {
    expect((await POST(request('{'))).status).toBe(400)
    expect((await POST(request(JSON.stringify({ ...payload, type: 'unexpectedEvent' })))).status).toBe(400)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })

  it('passes the event timestamp used to ignore stale deliveries', async () => {
    mocks.processWebhook.mockResolvedValue({ duplicate: false, updated: false })
    const response = await POST(request(JSON.stringify({ ...payload, createdAtMs: '2020-02-21 13:23:19.321' })))
    expect(response.status).toBe(200)
    expect(mocks.processWebhook).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      eventCreatedAt: new Date('2020-02-21T13:23:19.321Z'),
    }), 'applicantReviewed')
  })

  it('retains support for numeric millisecond timestamps', async () => {
    const response = await POST(request(JSON.stringify({ ...payload, createdAtMs: '1600000000000' })))
    expect(response.status).toBe(200)
    expect(mocks.processWebhook).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      eventCreatedAt: new Date('2020-09-13T12:26:40.000Z'),
    }), 'applicantReviewed')
  })

  it('rejects malformed UTC webhook timestamps', async () => {
    const response = await POST(request(JSON.stringify({ ...payload, createdAtMs: '2026-99-30 08:04:23.379' })))
    expect(response.status).toBe(400)
    expect(mocks.processWebhook).not.toHaveBeenCalled()
  })
})
