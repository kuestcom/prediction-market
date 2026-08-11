import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAffiliateByReference: vi.fn(),
}))

vi.mock('@/lib/db/queries/affiliate', () => ({
  AffiliateRepository: {
    getAffiliateByReference: mocks.getAffiliateByReference,
  },
}))

describe('affiliate referral route', () => {
  beforeEach(() => {
    mocks.getAffiliateByReference.mockReset()
    mocks.getAffiliateByReference.mockResolvedValue({
      data: {
        id: 'user-1',
        affiliate_code: 'a1b2c3d4',
        username: 'alice',
        address: '0x1111111111111111111111111111111111111111',
        image: null,
      },
      error: null,
    })
  })

  it('uses a relative redirect while storing the canonical affiliate code', async () => {
    const { GET } = await import('@/app/[locale]/(platform)/r/[code]/route')
    const response = await GET(new Request('https://0.0.0.0:3000/r/alice?to=/event/market'), {
      params: Promise.resolve({ code: 'alice' }),
    })

    expect(mocks.getAffiliateByReference).toHaveBeenCalledWith('alice')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/event/market')
    expect(JSON.parse(response.cookies.get('platform_affiliate')?.value ?? '{}')).toEqual({
      affiliateCode: 'a1b2c3d4',
      timestamp: expect.any(Number),
    })
  })

  it('redirects an unknown reference to the same public origin', async () => {
    mocks.getAffiliateByReference.mockResolvedValueOnce({ data: null, error: null })
    const { GET } = await import('@/app/[locale]/(platform)/r/[code]/route')
    const response = await GET(new Request('https://0.0.0.0:3000/r/missing'), {
      params: Promise.resolve({ code: 'missing' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/')
    expect(response.cookies.get('platform_affiliate')).toBeUndefined()
  })

  it('does not allow an external redirect target', async () => {
    const { GET } = await import('@/app/[locale]/(platform)/r/[code]/route')
    const response = await GET(new Request('https://0.0.0.0:3000/r/alice?to=https://attacker.test'), {
      params: Promise.resolve({ code: 'alice' }),
    })

    expect(response.headers.get('location')).toBe('/')
  })
})
