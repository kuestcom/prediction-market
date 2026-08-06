import { describe, expect, it } from 'vitest'

import { resolveAffiliateQueryRedirect } from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'

describe('affiliate query alias', () => {
  it('forwards a username from ?r= while preserving the destination query', () => {
    expect(
      resolveAffiliateQueryRedirect('http://0.0.0.0:3000/event/market?outcome=yes&r=alice', 'https://site2.com'),
    ).toBe('https://site2.com/r/alice?to=%2Fevent%2Fmarket%3Foutcome%3Dyes')
  })

  it('does not redirect an affiliate route again', () => {
    expect(resolveAffiliateQueryRedirect('https://kuest.com/r/alice?r=alice', 'https://kuest.com')).toBeNull()
  })

  it('keeps attribution on the visited custom domain', () => {
    expect(
      resolveAffiliateQueryRedirect('https://fork.example/event/market?r=alice', 'https://configured.example'),
    ).toBe('https://fork.example/r/alice?to=%2Fevent%2Fmarket')
  })
})
