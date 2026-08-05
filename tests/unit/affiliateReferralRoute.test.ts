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

  it('resolves a username while storing the canonical affiliate code', async () => {
    const { GET } = await import('@/app/[locale]/(platform)/r/[code]/route')
    const response = await GET(new Request('https://kuest.com/r/alice?to=/event/market'), {
      params: Promise.resolve({ code: 'alice' }),
    })

    expect(mocks.getAffiliateByReference).toHaveBeenCalledWith('alice')
    expect(response.headers.get('location')).toBe('https://kuest.com/event/market')
    expect(JSON.parse(response.cookies.get('platform_affiliate')?.value ?? '{}')).toEqual({
      affiliateCode: 'a1b2c3d4',
      timestamp: expect.any(Number),
    })
  })
})
