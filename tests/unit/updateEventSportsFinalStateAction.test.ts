import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  getCurrentUser: vi.fn(),
  setEventSportsFinalState: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mocks.revalidatePath(...args),
  updateTag: (...args: any[]) => mocks.updateTag(...args),
}))

vi.mock('@/lib/db/queries/user', () => ({
  UserRepository: {
    getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args),
  },
}))

vi.mock('@/lib/db/queries/event', () => ({
  EventRepository: {
    setEventSportsFinalState: (...args: any[]) => mocks.setEventSportsFinalState(...args),
  },
}))

function mockSavedSportsFinalState() {
  mocks.setEventSportsFinalState.mockResolvedValue({
    data: {
      id: 'event-1',
      slug: 'arsenal-vs-chelsea-2026-07-06',
      sports_score: null,
      sports_live: null,
      sports_ended: false,
      sports_source_provider: null,
      sports_source_event_id: null,
      sports_source_game_id: null,
      sports_source_league_id: null,
      sports_source_league_label: null,
      sports_source_match_confidence: null,
    },
    error: null,
  })
}

describe('updateEventSportsFinalStateAction', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.revalidatePath.mockReset()
    mocks.updateTag.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.setEventSportsFinalState.mockReset()
    mocks.getCurrentUser.mockResolvedValue({ id: 'admin-1', is_admin: true })
    mockSavedSportsFinalState()
  })

  it('passes null livestreamUrl through to clear an existing livestream', async () => {
    const { updateEventSportsFinalStateAction } = await import('@/app/[locale]/admin/events/_actions/update-event-sports-final-state')

    await updateEventSportsFinalStateAction('event-1', {
      sportsEnded: false,
      sportsScore: '',
      livestreamUrl: null,
    })

    expect(mocks.setEventSportsFinalState).toHaveBeenCalledWith('event-1', expect.objectContaining({
      livestreamUrl: null,
    }))
  })

  it('normalizes an empty livestreamUrl to null when the field is submitted', async () => {
    const { updateEventSportsFinalStateAction } = await import('@/app/[locale]/admin/events/_actions/update-event-sports-final-state')

    await updateEventSportsFinalStateAction('event-1', {
      sportsEnded: false,
      sportsScore: '',
      livestreamUrl: '',
    })

    expect(mocks.setEventSportsFinalState).toHaveBeenCalledWith('event-1', expect.objectContaining({
      livestreamUrl: null,
    }))
  })

  it('invalidates home featured markets after sports final state changes', async () => {
    const { updateEventSportsFinalStateAction } = await import('@/app/[locale]/admin/events/_actions/update-event-sports-final-state')

    await updateEventSportsFinalStateAction('event-1', {
      sportsEnded: true,
      sportsScore: '2-1',
    })

    expect(mocks.updateTag).toHaveBeenCalledWith('home:featured-events')
  })
})
