import { describe, expect, it } from 'vitest'
import { buildMarketSlugSelectionSignature } from '@/app/[locale]/(platform)/sports/_utils/sports-event-selection'

describe('buildMarketSlugSelectionSignature', () => {
  it('returns null when there is no selected market button', () => {
    expect(buildMarketSlugSelectionSignature({
      activeCardId: 'card-1',
      marketSlugToButtonKey: null,
      usesSectionLayout: true,
    })).toBeNull()
  })

  it('includes layout mode in the signature', () => {
    expect(buildMarketSlugSelectionSignature({
      activeCardId: 'card-1',
      marketSlugToButtonKey: 'button-1',
      usesSectionLayout: true,
    })).toBe('card-1:section:button-1')

    expect(buildMarketSlugSelectionSignature({
      activeCardId: 'card-1',
      marketSlugToButtonKey: 'button-1',
      usesSectionLayout: false,
    })).toBe('card-1:aux:button-1')
  })
})
