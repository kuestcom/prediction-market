import { describe, expect, it } from 'vitest'
import { buildAdminSportsDerivedContent, createInitialAdminSportsForm } from '@/lib/admin-sports-create'

describe('admin sports create', () => {
  it('normalizes props variants to standard for slug and payload', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'props'
    sports.eventVariant = 'exact_score'
    sports.sportSlug = 'Basketball'
    sports.leagueSlug = 'NBA'
    sports.startTime = '2026-03-10T19:00:00Z'
    sports.teams[0].name = 'Lakers'
    sports.teams[1].name = 'Celtics'
    sports.props = [{
      id: 'prop-1',
      playerName: 'LeBron James',
      statType: 'points',
      line: '27.5',
      teamHostStatus: 'home',
    }]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.eventSlug).toBe('lakers-vs-celtics-abc')
    expect(derived.payload?.eventVariant).toBe('standard')
  })

  it('builds a props payload even when eventVariant is blank', () => {
    const sports = createInitialAdminSportsForm()
    sports.section = 'props'
    sports.eventVariant = ''
    sports.sportSlug = 'Basketball'
    sports.leagueSlug = 'NBA'
    sports.startTime = '2026-03-10T19:00:00Z'
    sports.teams[0].name = 'Lakers'
    sports.teams[1].name = 'Celtics'
    sports.props = [{
      id: 'prop-1',
      playerName: 'LeBron James',
      statType: 'points',
      line: '27.5',
      teamHostStatus: 'home',
    }]

    const derived = buildAdminSportsDerivedContent({
      baseSlug: 'lakers-vs-celtics-abc',
      sports,
    })

    expect(derived.eventSlug).toBe('lakers-vs-celtics-abc')
    expect(derived.payload).not.toBeNull()
    expect(derived.payload?.eventVariant).toBe('standard')
    expect(derived.payload?.props).toHaveLength(1)
  })
})
