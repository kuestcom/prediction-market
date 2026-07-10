import { parseSportsScore } from '@/lib/sports-resolution'

export function resolveHomeFeaturedSportsScoreLabel(value: string | null | undefined) {
  const score = parseSportsScore(value)
  if (!score) {
    return null
  }

  return `${score.team1} - ${score.team2}`
}

export function resolveHomeFeaturedSportsScoreboardContent({
  score,
  temporalStatus,
  liveMeta,
}: {
  score: string | null | undefined
  temporalStatus: string
  liveMeta?: string | null
}) {
  return {
    scoreLabel: resolveHomeFeaturedSportsScoreLabel(score),
    showLiveStatus: temporalStatus === 'live',
    liveMeta: liveMeta?.trim() || null,
  }
}
