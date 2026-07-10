import {
  resolveHomeFeaturedSportsScoreboardContent,
  resolveHomeFeaturedSportsScoreLabel,
} from '@/lib/home-featured-sports-score'

describe('homeFeaturedSportsScore', () => {
  it('formats parsed sports scores for the home carousel scoreboard', () => {
    expect(resolveHomeFeaturedSportsScoreLabel('2 - 1')).toBe('2 - 1')
  })

  it('does not invent a score when score data is missing or invalid', () => {
    expect(resolveHomeFeaturedSportsScoreLabel(null)).toBeNull()
    expect(resolveHomeFeaturedSportsScoreLabel('LIVE')).toBeNull()
  })

  it('keeps live status visible when score data is missing', () => {
    expect(resolveHomeFeaturedSportsScoreboardContent({
      score: null,
      temporalStatus: 'live',
      liveMeta: '1H · 21',
    })).toEqual({
      scoreLabel: null,
      showLiveStatus: true,
      liveMeta: '1H · 21',
    })
  })
})
