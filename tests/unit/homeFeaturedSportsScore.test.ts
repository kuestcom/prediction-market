import { resolveHomeFeaturedSportsScoreLabel } from '@/lib/home-featured-sports-score'

describe('homeFeaturedSportsScore', () => {
  it('formats parsed sports scores for the home carousel scoreboard', () => {
    expect(resolveHomeFeaturedSportsScoreLabel('2 - 1')).toBe('2 - 1')
  })

  it('does not invent a score when score data is missing or invalid', () => {
    expect(resolveHomeFeaturedSportsScoreLabel(null)).toBeNull()
    expect(resolveHomeFeaturedSportsScoreLabel('LIVE')).toBeNull()
  })
})
