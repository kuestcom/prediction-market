import { parseSportsScore } from '@/lib/sports-resolution'

export function resolveHomeFeaturedSportsScoreLabel(value: string | null | undefined) {
  const score = parseSportsScore(value)
  if (!score) {
    return null
  }

  return `${score.team1} - ${score.team2}`
}
