import { describe, expect, it } from 'vitest'

import { canReusePriceHistoryPlaceholder } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'

describe('useEventPriceHistory', () => {
  const previousKey = ['event-price-history', 'https://clob.test', 'event-a', '1H', 'market-a:token-a', '']

  it('keeps previous history while only the selected time range changes', () => {
    expect(canReusePriceHistoryPlaceholder(previousKey, 'https://clob.test', 'event-a', 'market-a:token-a')).toBe(true)
  })

  it('does not carry placeholder history across events, markets or CLOB origins', () => {
    expect(canReusePriceHistoryPlaceholder(previousKey, 'https://clob.test', 'event-b', 'market-a:token-a')).toBe(false)
    expect(canReusePriceHistoryPlaceholder(previousKey, 'https://clob.test', 'event-a', 'market-b:token-b')).toBe(false)
    expect(canReusePriceHistoryPlaceholder(previousKey, 'https://other-clob.test', 'event-a', 'market-a:token-a')).toBe(
      false,
    )
  })
})
