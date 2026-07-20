import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeSumsubApplicantStatus, SumsubClient } from '@/lib/sumsub/client'

afterEach(() => vi.restoreAllMocks())

describe('sumsub client', () => {
  it('signs timestamp, uppercase method, path/query and exact body', () => {
    const client = new SumsubClient({ appToken: 'app-token', secretKey: 'secret-key' })
    const timestamp = 1_700_000_000
    const path = '/resources/accessTokens/sdk?test=true'
    const body = '{"ttlInSecs":600,"userId":"kuest:user-1"}'
    const expected = createHmac('sha256', 'secret-key')
      .update(`${timestamp}POST${path}${body}`)
      .digest('hex')
    expect(client.buildSignature(timestamp, 'post', path, body)).toBe(expected)
  })

  it('sends the exact signed access-token body and authenticated headers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      token: 'temporary-token',
      userId: 'kuest:user-1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = new SumsubClient({ appToken: 'app-token', secretKey: 'secret-key' })

    await expect(client.createAccessToken('kuest:user-1', 'basic-kyc-level')).resolves.toBe('temporary-token')
    const [, init] = fetchMock.mock.calls[0]!
    const body = JSON.stringify({ ttlInSecs: 600, userId: 'kuest:user-1', levelName: 'basic-kyc-level' })
    expect(init?.body).toBe(body)
    expect(new Headers(init?.headers).get('X-App-Access-Sig')).toBe(
      client.buildSignature(1_700_000_000, 'POST', '/resources/accessTokens/sdk', body),
    )
  })

  it('moves existing applicants to a newly configured verification level', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const client = new SumsubClient({ appToken: 'app-token', secretKey: 'secret-key' })

    await client.moveApplicantToLevel('applicant/1', 'enhanced kyc')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sumsub.com/resources/applicants/applicant%2F1/moveToLevel?name=enhanced%20kyc',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    )
  })

  it('rejects UTF-8 responses larger than 64 KiB without a content-length header', async () => {
    const body = JSON.stringify({
      token: 'é'.repeat(32_768),
      userId: 'kuest:user-1',
    })
    expect(body.length).toBeLessThan(64 * 1024)
    expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(64 * 1024)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const client = new SumsubClient({ appToken: 'app-token', secretKey: 'secret-key' })

    await expect(client.createAccessToken('kuest:user-1', 'basic-kyc-level'))
      .rejects
      .toThrow('Sumsub returned an invalid response.')
  })

  it('normalizes only GREEN as approved', () => {
    expect(normalizeSumsubApplicantStatus({ id: '1', review: { reviewResult: { reviewAnswer: 'GREEN' } } })).toBe('approved')
    expect(normalizeSumsubApplicantStatus({ id: '1', review: { reviewResult: { reviewAnswer: 'RED' } } })).toBe('rejected')
    expect(normalizeSumsubApplicantStatus({ id: '1', review: { reviewStatus: 'onHold' } })).toBe('on_hold')
  })
})
