const AUTOMATIC_SPORTS_SOURCE_CONFIDENCE_THRESHOLD = 0.72

interface SportsSourceCardCandidate {
  confidence: number
  matchReason: string[]
}

export function resolveAutomaticSportsSourceCardCandidate<T extends SportsSourceCardCandidate>(
  candidates: readonly T[],
) {
  if (candidates.length !== 1) {
    return null
  }

  const candidate = candidates[0]
  if (
    !candidate ||
    candidate.confidence < AUTOMATIC_SPORTS_SOURCE_CONFIDENCE_THRESHOLD ||
    !candidate.matchReason.includes('series')
  ) {
    return null
  }

  return candidate
}
