import { describe, expect, it } from 'vitest'

import {
  resolvePandaScoreSegmentScores,
  resolveSportsSegmentNumbers,
  resolveSportsSourceSegmentCount,
} from '@/lib/sports-segment-score'

describe('sports segment scores', () => {
  it('maps PandaScore game results to match opponent order', () => {
    expect(
      resolvePandaScoreSegmentScores(
        [
          {
            position: 2,
            results: [
              { team_id: 22, score: 13 },
              { team_id: 11, score: 16 },
            ],
          },
          {
            position: 1,
            results: [
              { team_id: 11, score: 13 },
              { team_id: 22, score: 9 },
            ],
          },
        ],
        [{ opponent: { id: 11 } }, { opponent: { id: 22 } }],
      ),
    ).toEqual([
      { segment: 1, homeScore: 13, awayScore: 9 },
      { segment: 2, homeScore: 16, awayScore: 13 },
    ])
  })

  it('keeps every game when PandaScore repeats a map position', () => {
    expect(
      resolvePandaScoreSegmentScores(
        [
          {
            position: 1,
            results: [
              { team_id: 11, score: 13 },
              { team_id: 22, score: 9 },
            ],
          },
          {
            position: 1,
            results: [
              { team_id: 11, score: 8 },
              { team_id: 22, score: 13 },
            ],
          },
        ],
        [{ opponent: { id: 11 } }, { opponent: { id: 22 } }],
      ),
    ).toEqual([
      { segment: 1, homeScore: 13, awayScore: 9 },
      { segment: 2, homeScore: 8, awayScore: 13 },
    ])
  })

  it('uses the best-of label to render unplayed maps', () => {
    expect(
      resolveSportsSegmentNumbers({
        title: 'CYBERSHOKE Esports vs GenOne (BO3)',
        scores: [{ segment: 1, homeScore: 13, awayScore: 9 }],
      }),
    ).toEqual([
      { segment: 1, homeScore: 13, awayScore: 9 },
      { segment: 2, homeScore: null, awayScore: null },
      { segment: 3, homeScore: null, awayScore: null },
    ])
  })

  it('uses PandaScore number_of_games before maps or scores exist', () => {
    const segmentCount = resolveSportsSourceSegmentCount({ raw: { number_of_games: 3 } })

    expect(resolveSportsSegmentNumbers({ segmentCount })).toEqual([
      { segment: 1, homeScore: null, awayScore: null },
      { segment: 2, homeScore: null, awayScore: null },
      { segment: 3, homeScore: null, awayScore: null },
    ])
  })
})
