import type { SportsSegmentScore } from '@/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePositiveInteger(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(number) && number > 0 ? number : null
}

function normalizeSportsSegmentCount(value: unknown) {
  const count = normalizePositiveInteger(value)
  return count && count <= 9 ? count : null
}

function normalizeScore(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isInteger(number) && number >= 0 ? number : null
}

function normalizeIdentifier(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    return normalized || null
  }

  return null
}

export function normalizeSportsSegmentScores(value: unknown): SportsSegmentScore[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const scoresBySegment = new Map<number, SportsSegmentScore>()
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const segment = normalizePositiveInteger(item.segment ?? item.position)
    if (!segment || scoresBySegment.has(segment)) {
      continue
    }

    scoresBySegment.set(segment, {
      segment,
      homeScore: normalizeScore(item.homeScore ?? item.home_score),
      awayScore: normalizeScore(item.awayScore ?? item.away_score),
    })
  }

  const scores = [...scoresBySegment.values()].sort((left, right) => left.segment - right.segment)
  return scores.length > 0 ? scores : null
}

function mergeSportsSegmentScores(scores: SportsSegmentScore[] | null | undefined, segmentNumbers: number[] = []) {
  const scoresBySegment = new Map((scores ?? []).map((score) => [score.segment, score]))
  const segments = new Set(segmentNumbers.filter((segment) => Number.isInteger(segment) && segment > 0))
  for (const score of scores ?? []) {
    segments.add(score.segment)
  }

  return [...segments]
    .sort((left, right) => left - right)
    .map((segment) => scoresBySegment.get(segment) ?? { segment, homeScore: null, awayScore: null })
}

export function areSportsSegmentScoresEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizeSportsSegmentScores(left)) === JSON.stringify(normalizeSportsSegmentScores(right))
}

export function resolveSportsSegmentNumbers(input: {
  scores?: SportsSegmentScore[] | null
  title?: string | null
  segmentNumbers?: number[]
  segmentCount?: number | null
}) {
  const explicitSegments = input.segmentNumbers ?? []
  const matchLength = input.title?.match(/\bbo\s*(\d+)\b/i)
  const bestOf =
    normalizeSportsSegmentCount(input.segmentCount) ??
    (matchLength ? normalizeSportsSegmentCount(matchLength[1]) : null)
  const expectedSegments = bestOf ? Array.from({ length: bestOf }, (_, index) => index + 1) : []

  return mergeSportsSegmentScores(input.scores, [...explicitSegments, ...expectedSegments])
}

export function resolveSportsSourceSegmentCount(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const raw = isRecord(value.raw) ? value.raw : value
  return normalizeSportsSegmentCount(raw.number_of_games ?? raw.best_of ?? raw.bestOf)
}

export function resolvePandaScoreSegmentScores(rawGames: unknown, rawOpponents: unknown): SportsSegmentScore[] | null {
  if (!Array.isArray(rawGames)) {
    return null
  }

  const opponentIds = Array.isArray(rawOpponents)
    ? rawOpponents
        .map((item) => {
          if (!isRecord(item)) {
            return null
          }
          const opponent = isRecord(item.opponent) ? item.opponent : item
          return normalizeIdentifier(opponent.id)
        })
        .slice(0, 2)
    : []
  const scores: SportsSegmentScore[] = []
  const usedSegments = new Set<number>()

  for (let index = 0; index < rawGames.length; index += 1) {
    const game = rawGames[index]
    if (!isRecord(game)) {
      continue
    }

    const reportedSegment = normalizePositiveInteger(game.position)
    let segment = reportedSegment ?? index + 1
    while (usedSegments.has(segment)) {
      segment += 1
    }
    usedSegments.add(segment)
    const results = Array.isArray(game.results) ? game.results.filter(isRecord) : []
    const scoresByTeamId = new Map<string, number | null>()
    for (const result of results) {
      const teamId = normalizeIdentifier(result.team_id)
      if (teamId) {
        scoresByTeamId.set(teamId, normalizeScore(result.score))
      }
    }
    const homeScore = opponentIds[0]
      ? (scoresByTeamId.get(opponentIds[0]) ?? null)
      : (normalizeScore(results[0]?.score) ?? null)
    const awayScore = opponentIds[1]
      ? (scoresByTeamId.get(opponentIds[1]) ?? null)
      : (normalizeScore(results[1]?.score) ?? null)

    scores.push({ segment, homeScore, awayScore })
  }

  return normalizeSportsSegmentScores(scores)
}
