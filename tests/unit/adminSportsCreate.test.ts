import { describe, expect, it } from 'vitest'
import {
  buildAdminSportsDerivedContent,
  createAdminSportsCustomMarket,
  createInitialAdminSportsForm,
} from '@/lib/admin-sports-create'

describe('admin sports create', () => {
  it('normalizes props variants to standard for slug and payload', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'props'
    sports.eventVariant = 'exact_score'
    sports.props = [{
      id: 'prop-1',
      playerName: 'LeBron James',
      statType: 'points',
      line: '27.5',
      teamHostStatus: '',
    }]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.eventSlug).toBe('lakers-vs-celtics-abc')
    expect(derived.payload?.eventVariant).toBe('standard')
    expect(derived.payload?.sportSlug).toBeUndefined()
    expect(derived.payload?.leagueSlug).toBeUndefined()
    expect(derived.payload?.teams).toBeUndefined()
  })

  it('builds a props payload even when eventVariant is blank', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'props'
    sports.eventVariant = ''
    sports.props = [{
      id: 'prop-1',
      playerName: 'LeBron James',
      statType: 'points',
      line: '27.5',
      teamHostStatus: '',
    }]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.eventSlug).toBe('lakers-vs-celtics-abc')
    expect(derived.payload).not.toBeNull()
    expect(derived.payload?.eventVariant).toBe('standard')
    expect(derived.payload?.props).toHaveLength(1)
    expect(derived.categories.map(category => category.slug)).toEqual([
      'sports',
      'props',
      'sports-props',
      'points',
      'player-props',
    ])
  })

  it('builds custom sports markets from explicit market rows', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'custom'
    sports.sportSlug = 'Basketball'
    sports.leagueSlug = 'NBA'
    sports.startTime = '2026-03-10T19:00:00Z'
    sports.teams[0].name = 'Lakers'
    sports.teams[1].name = 'Celtics'
    sports.customMarkets = [
      {
        ...createAdminSportsCustomMarket('market-1'),
        sportsMarketType: 'first_half_moneyline',
        question: '1H Moneyline',
        title: '1H Moneyline',
        shortName: '1H ML',
        outcomeOne: 'Lakers',
        outcomeTwo: 'Celtics',
        iconAssetKey: 'home',
      },
      {
        ...createAdminSportsCustomMarket('market-2'),
        sportsMarketType: 'first_half_totals',
        question: '1H O/U 110.5',
        title: '1H O/U 110.5',
        shortName: '1H O/U 110.5',
        outcomeOne: 'Over',
        outcomeTwo: 'Under',
        line: '110.5',
      },
    ]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.eventSlug).toBe('lakers-vs-celtics-abc-custom-markets')
    expect(derived.options).toHaveLength(2)
    expect(derived.payload?.eventVariant).toBe('custom')
    expect(derived.payload?.markets).toEqual([
      expect.objectContaining({
        sportsMarketType: 'first_half_moneyline',
        outcomes: ['Lakers', 'Celtics'],
        iconAssetKey: 'home',
      }),
      expect.objectContaining({
        sportsMarketType: 'first_half_totals',
        outcomes: ['Over', 'Under'],
        line: 110.5,
      }),
    ])
  })

  it('skips custom market rows that require a line when the line is missing', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'custom'
    sports.sportSlug = 'Basketball'
    sports.leagueSlug = 'NBA'
    sports.startTime = '2026-03-10T19:00:00Z'
    sports.teams[0].name = 'Lakers'
    sports.teams[1].name = 'Celtics'
    sports.customMarkets = [
      {
        ...createAdminSportsCustomMarket('market-1'),
        sportsMarketType: 'first_half_totals',
        question: '1H O/U',
        title: '1H O/U',
        shortName: '1H O/U',
        outcomeOne: 'Over',
        outcomeTwo: 'Under',
        line: '',
      },
      {
        ...createAdminSportsCustomMarket('market-2'),
        sportsMarketType: 'first_half_moneyline',
        question: '1H Moneyline',
        title: '1H Moneyline',
        shortName: '1H ML',
        outcomeOne: 'Lakers',
        outcomeTwo: 'Celtics',
      },
    ]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.options).toHaveLength(1)
    expect(derived.payload?.markets).toEqual([
      expect.objectContaining({
        sportsMarketType: 'first_half_moneyline',
      }),
    ])
  })
})
