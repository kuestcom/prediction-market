import {
  hasSportsGamesCardPrimaryMarketTrio,
  resolveSportsGamesCardCollapsedMarketType,
} from '@/app/[locale]/(platform)/sports/_components/sports-games-data'

describe('sportsGamesCardLayout', () => {
  it('returns true only when moneyline, spread, and total are all present', () => {
    expect(hasSportsGamesCardPrimaryMarketTrio({
      buttons: [
        { marketType: 'moneyline' },
        { marketType: 'spread' },
        { marketType: 'total' },
      ] as any,
    })).toBe(true)

    expect(hasSportsGamesCardPrimaryMarketTrio({
      buttons: [
        { marketType: 'moneyline' },
        { marketType: 'spread' },
      ] as any,
    })).toBe(false)
  })

  it('does not treat auxiliary groups as completing the trio', () => {
    expect(hasSportsGamesCardPrimaryMarketTrio({
      buttons: [
        { marketType: 'moneyline' },
        { marketType: 'total' },
        { marketType: 'btts' },
      ] as any,
    })).toBe(false)
  })

  it('falls back to the first available collapsed market type when the trio is missing', () => {
    expect(resolveSportsGamesCardCollapsedMarketType({
      buttons: [
        { marketType: 'binary' },
        { marketType: 'spread' },
      ] as any,
    })).toBe('binary')

    expect(resolveSportsGamesCardCollapsedMarketType({
      buttons: [
        { marketType: 'moneyline' },
        { marketType: 'binary' },
      ] as any,
    })).toBe('moneyline')
  })
})
