import { describe, expect, it } from 'vitest'
import {
  buildAdminSportsDerivedContent,
  createAdminSportsCustomMarket,
  createInitialAdminSportsForm,
} from '@/lib/admin-sports-create'
import { normalizeDateTimeLocalValue } from '@/lib/datetime-local'

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
    expect(derived.options.map(option => option.id)).toEqual([
      'moneyline-home',
      'moneyline-away',
      'market-1',
      'market-2',
    ])
    expect(derived.payload?.eventVariant).toBe('custom')
    expect(derived.payload?.markets).toEqual([
      expect.objectContaining({
        id: 'moneyline-home',
        sportsMarketType: 'moneyline',
        iconAssetKey: 'home',
      }),
      expect.objectContaining({
        id: 'moneyline-away',
        sportsMarketType: 'moneyline',
        iconAssetKey: 'away',
      }),
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

    expect(derived.options.map(option => option.id)).toEqual([
      'moneyline-home',
      'moneyline-away',
      'market-2',
    ])
    expect(derived.payload?.markets).toEqual([
      expect.objectContaining({
        id: 'moneyline-home',
        sportsMarketType: 'moneyline',
      }),
      expect.objectContaining({
        id: 'moneyline-away',
        sportsMarketType: 'moneyline',
      }),
      expect.objectContaining({
        sportsMarketType: 'first_half_moneyline',
      }),
    ])
  })

  it('preserves the selected local game date for sports previews and AI payloads', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'standard'
    sports.sportSlug = 'Soccer'
    sports.leagueSlug = 'MLS'
    sports.startTime = '2026-04-01T21:00'
    sports.teams[0].name = 'LA Galaxy'
    sports.teams[1].name = 'Inter Miami'

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'la-galaxy-vs-inter-miami-abc',
      sports,
    })

    expect(derived.options[0]?.question).toContain('2026-04-01')
    expect(derived.payload?.eventDate).toBe('2026-04-01')
    expect(normalizeDateTimeLocalValue(derived.payload?.startTime ?? '')).toBe('2026-04-01T21:00')
  })

  it('keeps moneyline markets mandatory inside exact score sports packs', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'exact_score'
    sports.sportSlug = 'Soccer'
    sports.leagueSlug = 'MLS'
    sports.startTime = '2026-04-01T21:00'
    sports.teams[0].name = 'LA Galaxy'
    sports.teams[1].name = 'Inter Miami'

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'la-galaxy-vs-inter-miami-abc',
      sports,
    })

    expect(derived.options.map(option => option.id).slice(0, 2)).toEqual([
      'moneyline-home',
      'moneyline-away',
    ])
    expect(derived.options.some(option => option.id === 'exact-score-0-0')).toBe(true)
    expect(derived.options.some(option => option.id === 'exact-score-any-other')).toBe(true)
  })

  it('includes draw in the mandatory base moneyline when enabled for game packs', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'exact_score'
    sports.sportSlug = 'Soccer'
    sports.leagueSlug = 'MLS'
    sports.startTime = '2026-04-01T21:00'
    sports.includeDraw = true
    sports.teams[0].name = 'LA Galaxy'
    sports.teams[1].name = 'Inter Miami'

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'la-galaxy-vs-inter-miami-abc',
      sports,
    })

    expect(derived.options.map(option => option.id).slice(0, 3)).toEqual([
      'moneyline-home',
      'moneyline-draw',
      'moneyline-away',
    ])
  })

  it('includes draw in the mandatory custom base moneyline when enabled', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'games'
    sports.eventVariant = 'custom'
    sports.sportSlug = 'Soccer'
    sports.leagueSlug = 'MLS'
    sports.startTime = '2026-04-01T21:00'
    sports.includeDraw = true
    sports.teams[0].name = 'LA Galaxy'
    sports.teams[1].name = 'Inter Miami'
    sports.customMarkets = [{
      ...createAdminSportsCustomMarket('market-1'),
      sportsMarketType: 'first_half_moneyline',
      question: '1H moneyline',
      title: '1H Moneyline',
      shortName: '1H ML',
      outcomeOne: 'LA Galaxy',
      outcomeTwo: 'Inter Miami',
    }]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'la-galaxy-vs-inter-miami-abc',
      sports,
    })

    expect(derived.payload?.markets.slice(0, 3).map(market => market.id)).toEqual([
      'moneyline-home',
      'moneyline-draw',
      'moneyline-away',
    ])
  })
})
