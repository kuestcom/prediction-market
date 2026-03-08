import { describe, expect, it } from 'vitest'
import { getThemeSiteSettingsFormState, validateThemeSiteSettingsInput } from '@/lib/theme-settings'
import { createDefaultThemeSiteIdentity } from '@/lib/theme-site-identity'

function createValidationInput() {
  const defaults = createDefaultThemeSiteIdentity()

  return {
    siteName: defaults.name,
    siteDescription: defaults.description,
    logoMode: defaults.logoMode,
    logoSvg: defaults.logoSvg,
    logoImagePath: '',
    pwaIcon192Path: '',
    pwaIcon512Path: '',
    googleAnalyticsId: '',
    discordLink: '',
    twitterLink: '',
    facebookLink: '',
    instagramLink: '',
    tiktokLink: '',
    linkedinLink: '',
    youtubeLink: '',
    supportUrl: '',
    feeRecipientWallet: '',
    marketCreators: '',
    lifiIntegrator: '',
    lifiApiKey: '',
  }
}

describe('themeSettings social links', () => {
  it('normalizes new social link inputs through theme site validation', () => {
    const result = validateThemeSiteSettingsInput({
      ...createValidationInput(),
      twitterLink: 'x.com/kuest',
      facebookLink: 'facebook.com/kuest',
      instagramLink: 'instagram.com/kuest',
      tiktokLink: 'tiktok.com/@kuest',
      linkedinLink: 'linkedin.com/company/kuest',
      youtubeLink: 'youtube.com/@kuest',
    })

    expect(result.error).toBeNull()
    expect(result.data?.twitterLinkValue).toBe('https://x.com/kuest')
    expect(result.data?.facebookLinkValue).toBe('https://facebook.com/kuest')
    expect(result.data?.instagramLinkValue).toBe('https://instagram.com/kuest')
    expect(result.data?.tiktokLinkValue).toBe('https://tiktok.com/@kuest')
    expect(result.data?.linkedinLinkValue).toBe('https://linkedin.com/company/kuest')
    expect(result.data?.youtubeLinkValue).toBe('https://youtube.com/@kuest')
  })

  it('hydrates new social link fields from general settings', () => {
    const state = getThemeSiteSettingsFormState({
      general: {
        site_twitter_link: {
          value: 'x.com/kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
        site_facebook_link: {
          value: 'facebook.com/kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
        site_instagram_link: {
          value: 'instagram.com/kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
        site_tiktok_link: {
          value: 'tiktok.com/@kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
        site_linkedin_link: {
          value: 'linkedin.com/company/kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
        site_youtube_link: {
          value: 'youtube.com/@kuest',
          updated_at: '2026-03-08T00:00:00.000Z',
        },
      },
    })

    expect(state.twitterLink).toBe('https://x.com/kuest')
    expect(state.facebookLink).toBe('https://facebook.com/kuest')
    expect(state.instagramLink).toBe('https://instagram.com/kuest')
    expect(state.tiktokLink).toBe('https://tiktok.com/@kuest')
    expect(state.linkedinLink).toBe('https://linkedin.com/company/kuest')
    expect(state.youtubeLink).toBe('https://youtube.com/@kuest')
  })
})
