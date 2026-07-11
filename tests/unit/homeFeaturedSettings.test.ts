import {
  getHomeFeaturedSettingsFromSettings,
  validateHomeFeaturedSettingsInput,
} from '@/lib/home-featured-settings'

describe('home featured settings', () => {
  it('loads the side card image mode from key-value settings', () => {
    const settings = getHomeFeaturedSettingsFromSettings({
      home_featured: {
        side_card_use_image: { value: 'true', updated_at: '' },
        side_card_image_path: {
          value: 'home-featured/side-card-123-abc123.webp',
          updated_at: '',
        },
      },
    })

    expect(settings.sideCard).toMatchObject({
      useImage: true,
      imagePath: 'home-featured/side-card-123-abc123.webp',
      imageUrl: '',
    })
  })

  it('rejects arbitrary side card image paths', () => {
    const result = validateHomeFeaturedSettingsInput({
      enabled: 'true',
      useAi: 'false',
      maxCards: '6',
      defaultContextMode: 'auto',
      newsSources: '',
      commentBlacklist: '',
      minVolume24h: '0',
      includeSportsToday: 'true',
      includeNewEvents: 'true',
      sideCardUseImage: 'true',
      sideCardImagePath: 'https://example.com/untrusted.svg',
    })

    expect(result.data?.sideCard.imagePath).toBe('')
  })

  it.each(['jpg', 'png', 'webp'])('accepts a stored .%s side card path', (extension) => {
    const result = validateHomeFeaturedSettingsInput({
      enabled: 'true',
      useAi: 'false',
      maxCards: '6',
      defaultContextMode: 'auto',
      newsSources: '',
      commentBlacklist: '',
      minVolume24h: '0',
      includeSportsToday: 'true',
      includeNewEvents: 'true',
      sideCardUseImage: 'true',
      sideCardImagePath: `home-featured/side-card-123-abc123.${extension}`,
    })

    expect(result.data?.sideCard.imagePath).toBe(`home-featured/side-card-123-abc123.${extension}`)
  })
})
