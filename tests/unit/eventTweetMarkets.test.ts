import { describe, expect, it } from 'vitest'
import {
  inferResolvedTweetMarketOutcome,
  parseTweetMarketRange,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'

describe('eventTweetMarkets', () => {
  it('parses common tweet market range formats', () => {
    expect(parseTweetMarketRange({ short_title: '340-359' })).toEqual({
      minInclusive: 340,
      maxInclusive: 359,
    })

    expect(parseTweetMarketRange({ short_title: '580+' })).toEqual({
      minInclusive: 580,
      maxInclusive: null,
    })

    expect(parseTweetMarketRange({ slug: 'elon-musk-of-tweets-march-17-march-24-580plus' })).toEqual({
      minInclusive: 580,
      maxInclusive: null,
    })

    expect(parseTweetMarketRange({ short_title: '<20' })).toEqual({
      minInclusive: null,
      maxInclusive: 19,
    })
  })

  it('infers resolved no when the live count has already exceeded the range ceiling', () => {
    expect(
      inferResolvedTweetMarketOutcome({ short_title: '340-359' }, 367, false),
    ).toBe(1)
  })

  it('infers final outcome correctly once the tracking window ends', () => {
    expect(
      inferResolvedTweetMarketOutcome({ short_title: '360-379' }, 367, true),
    ).toBe(0)

    expect(
      inferResolvedTweetMarketOutcome({ short_title: '580+' }, 367, true),
    ).toBe(1)
  })
})
