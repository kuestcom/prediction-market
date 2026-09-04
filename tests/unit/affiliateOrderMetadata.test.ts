import { describe, expect, it } from 'bun:test'

import { getAffiliateOrderMetadataQueryKey } from '@/hooks/useAffiliateOrderMetadata'

describe('affiliate order metadata query key', () => {
  it('changes when an anonymous visitor signs in through a referral', () => {
    const anonymousKey = getAffiliateOrderMetadataQueryKey(null, null)
    const referredUserKey = getAffiliateOrderMetadataQueryKey('user-1', 'affiliate-1')

    expect(anonymousKey).not.toEqual(referredUserKey)
    expect(referredUserKey).toEqual(['affiliate-order-info', 'user-1', 'affiliate-1'])
  })
})
