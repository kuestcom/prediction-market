import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as actualNextCache from 'next/cache'
import { Buffer } from 'node:buffer'

import { hoisted, spyOn, stubGlobal } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  revalidatePath: mock(),
  getCurrentUser: mock(),
  getSettings: mock(),
  replaceFeaturedEventsWithSettings: mock(),
  updateSettings: mock(),
  updateSettingsWithTermsOfService: mock(),
  decryptSecret: mock(),
  encryptSecret: mock(),
  upload: mock(),
  fetch: mock(),
}))

const VALID_JPEG_BASE64 =
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z'

function buildSideCardImageFormData(file: File) {
  const formData = new FormData()
  formData.set('site_name', 'Kuest')
  formData.set('site_description', 'Prediction market')
  formData.set('logo_mode', 'svg')
  formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  formData.set('logo_image_path', '')
  formData.set('home_featured_enabled', 'true')
  formData.set('home_featured_use_ai', 'false')
  formData.set('home_featured_max_cards', '6')
  formData.set('home_featured_default_context_mode', 'auto')
  formData.set('home_featured_news_sources', '')
  formData.set('home_featured_comment_blacklist', '')
  formData.set('home_featured_min_volume_24h', '0')
  formData.set('home_featured_include_sports_today', 'true')
  formData.set('home_featured_include_new_events', 'true')
  formData.set('home_featured_side_card_use_image', 'true')
  formData.set('home_featured_side_card_image_path', '')
  formData.set('home_featured_side_card_image', file)
  return formData
}

function buildHomeFeaturedFormData() {
  const formData = new FormData()
  formData.set('site_name', 'Kuest')
  formData.set('site_description', 'Prediction market')
  formData.set('logo_mode', 'svg')
  formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  formData.set('logo_image_path', '')
  formData.set('home_featured_enabled', 'true')
  formData.set('home_featured_use_ai', 'false')
  formData.set('home_featured_max_cards', '6')
  formData.set('home_featured_default_context_mode', 'auto')
  formData.set('home_featured_news_sources', '')
  formData.set('home_featured_comment_blacklist', '')
  formData.set('home_featured_min_volume_24h', '0')
  formData.set('home_featured_include_sports_today', 'true')
  formData.set('home_featured_include_new_events', 'true')
  return formData
}

void mock.module('next/cache', () => ({
  ...actualNextCache,
  revalidatePath: mocks.revalidatePath,
}))

void mock.module('@/lib/db/queries/user', () => ({
  UserRepository: { getCurrentUser: (...args: any[]) => mocks.getCurrentUser(...args) },
}))

void mock.module('@/lib/db/queries/settings', () => ({
  SettingsRepository: {
    getSettings: (...args: any[]) => mocks.getSettings(...args),
    updateSettings: (...args: any[]) => mocks.updateSettings(...args),
    updateSettingsWithTermsOfService: (...args: any[]) => mocks.updateSettingsWithTermsOfService(...args),
  },
}))

void mock.module('@/lib/db/queries/home-featured-events', () => ({
  HomeFeaturedEventsRepository: {
    replaceFeaturedEventsWithSettings: (...args: any[]) => mocks.replaceFeaturedEventsWithSettings(...args),
  },
}))

void mock.module('@/lib/encryption', () => ({
  decryptSecret: (...args: any[]) => mocks.decryptSecret(...args),
  encryptSecret: (...args: any[]) => mocks.encryptSecret(...args),
}))

void mock.module('@/lib/storage-upload', () => ({
  uploadPublicAsset: (...args: any[]) => mocks.upload(...args),
}))

describe('updateGeneralSettingsAction', () => {
  beforeEach(() => {
    stubGlobal('fetch', mocks.fetch)
    mocks.revalidatePath.mockReset()
    mocks.getCurrentUser.mockReset()
    mocks.getSettings.mockReset()
    mocks.replaceFeaturedEventsWithSettings.mockReset()
    mocks.updateSettings.mockReset()
    mocks.updateSettingsWithTermsOfService.mockReset()
    mocks.decryptSecret.mockReset()
    mocks.encryptSecret.mockReset()
    mocks.upload.mockReset()
    mocks.fetch.mockReset()
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getSettings.mockResolvedValue({ data: {}, error: null })
    mocks.replaceFeaturedEventsWithSettings.mockResolvedValue({ data: [], error: null })
    mocks.updateSettingsWithTermsOfService.mockResolvedValue({ data: [], error: null })
    mocks.encryptSecret.mockImplementation((value: string) => `enc.v1.${value}`)
    mocks.decryptSecret.mockReturnValue('')
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: mock().mockResolvedValue({}),
    })
  })

  it('rejects unauthenticated users', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Unauthenticated.' })
  })

  it('does not preserve Sumsub secrets that can no longer be decrypted', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        integrations: {
          sumsub_app_token: { value: 'enc.v1.invalid-app-token' },
          sumsub_secret_key: { value: 'enc.v1.invalid-secret-key' },
          sumsub_webhook_secret: { value: 'enc.v1.invalid-webhook-secret' },
        },
      },
      error: null,
    })
    const formData = buildHomeFeaturedFormData()
    formData.set('sumsub_enabled', 'true')
    formData.set('sumsub_enforcement', 'required')
    formData.set('sumsub_level_name', 'enhanced-kyc')
    formData.set('sumsub_app_token', '')
    formData.set('sumsub_secret_key', '')
    formData.set('sumsub_webhook_secret', '')

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: 'Complete all Sumsub credentials before enabling this enforcement mode.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('returns validation errors for invalid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', '')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result.error).toContain('Site name')
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('validates Market Context fields in the general settings payload', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set('market_context_enabled', 'true')
    formData.set('market_context_prompt', 'Too short')

    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: 'Please provide at least 20 characters for the prompt.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('does not update Market Context from a partial payload', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set('market_context_prompt', 'Summarize current market context clearly.')

    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload.some((entry) => entry.key === 'market_context_prompt')).toBe(false)
    expect(savedPayload.some((entry) => entry.key === 'market_context_enabled')).toBe(false)
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/[locale]/event/[slug]', 'page')
  })

  it('ignores legacy fee wallet fields in general settings payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', 'not-a-wallet')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload.some((entry) => entry.key === 'fee_recipient_wallet')).toBe(false)
  })

  it('saves normalized SVG site settings for valid payloads', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        general: {
          fee_recipient_wallet: {
            value: '0x1111111111111111111111111111111111111111',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        },
      },
      error: null,
    })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('google_analytics_id', 'G-TEST123')
    formData.set('discord_link', 'https://discord.gg/kuest')
    formData.set('support_url', 'support@kuest.com')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('lifi_integrator', 'kuest-fork')
    formData.set('lifi_api_key', 'lifi-123')
    formData.set('arbitrage_enabled', 'true')
    formData.set('arbitrage_multi_wallet_enabled', 'true')
    formData.set('openrouter_api_key', 'openrouter-123')
    formData.set('openrouter_model', 'openai/gpt-4o-mini')
    formData.set('market_context_enabled', 'false')
    formData.set('market_context_prompt', 'Summarize current market context clearly.')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)
    expect(mocks.encryptSecret).toHaveBeenCalledWith('lifi-123')
    expect(mocks.encryptSecret).toHaveBeenCalledWith('openrouter-123')

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload).toHaveLength(29)
    expect(savedPayload.find((entry) => entry.key === 'site_name')?.value).toBe('Kuest')
    expect(savedPayload.find((entry) => entry.key === 'site_description')?.value).toBe('Prediction market')
    expect(savedPayload.find((entry) => entry.key === 'site_logo_mode')?.value).toBe('svg')
    expect(savedPayload.find((entry) => entry.key === 'site_logo_image_path')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'pwa_icon_192_path')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'pwa_icon_512_path')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_google_analytics')?.value).toBe('G-TEST123')
    expect(savedPayload.find((entry) => entry.key === 'site_discord_link')?.value).toBe('https://discord.gg/kuest')
    expect(savedPayload.find((entry) => entry.key === 'site_twitter_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_facebook_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_instagram_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_tiktok_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_linkedin_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_youtube_link')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'site_support_url')?.value).toBe('mailto:support@kuest.com')
    expect(savedPayload.find((entry) => entry.key === 'blocked_countries')?.value).toBe('[]')
    expect(savedPayload.find((entry) => entry.key === 'global_announcement_message')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'global_announcement_link_url')?.value).toBe('')
    expect(savedPayload.find((entry) => entry.key === 'global_announcement_disabled_on')?.value).toBe('[]')
    expect(savedPayload.find((entry) => entry.key === 'global_announcement_disable_faucet_banner')?.value).toBe('false')
    expect(savedPayload.find((entry) => entry.key === 'site_custom_javascript_codes')).toBeUndefined()
    expect(savedPayload.some((entry) => entry.key === 'fee_recipient_wallet')).toBe(false)
    expect(savedPayload.find((entry) => entry.key === 'lifi_integrator')?.value).toBe('kuest-fork')
    expect(savedPayload.find((entry) => entry.key === 'arbitrage_enabled')).toEqual({
      group: 'integrations',
      key: 'arbitrage_enabled',
      value: 'true',
    })
    expect(savedPayload.find((entry) => entry.key === 'arbitrage_multi_wallet_enabled')).toEqual({
      group: 'integrations',
      key: 'arbitrage_multi_wallet_enabled',
      value: 'true',
    })
    expect(savedPayload.find((entry) => entry.key === 'lifi_api_key')?.value).toBe('enc.v1.lifi-123')
    expect(savedPayload.find((entry) => entry.key === 'sports_pandascore_token')).toBeUndefined()
    expect(savedPayload.find((entry) => entry.key === 'sports_thesportsdb_api_key')).toBeUndefined()
    expect(savedPayload.find((entry) => entry.group === 'ai' && entry.key === 'openrouter_model')?.value).toBe(
      'openai/gpt-4o-mini',
    )
    expect(savedPayload.find((entry) => entry.group === 'ai' && entry.key === 'openrouter_api_key')?.value).toBe(
      'enc.v1.openrouter-123',
    )
    expect(savedPayload.find((entry) => entry.group === 'ai' && entry.key === 'market_context_prompt')?.value).toBe(
      'Summarize current market context clearly.',
    )
    expect(savedPayload.find((entry) => entry.group === 'ai' && entry.key === 'market_context_enabled')?.value).toBe(
      'false',
    )

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin', 'layout')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/theme', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/tos', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/event/[slug]', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/event/[slug]/[market]', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/sports/[sport]/[event]', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/sports/[sport]/[event]/[market]', 'page')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/esports/[sport]/[...slugParts]', 'page')
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/[locale]', 'layout')
  })

  it('saves SVG settings without loading sharp', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })
    void mock.module('sharp', () => {
      throw new Error('sharp should not load for SVG-only settings saves')
    })

    try {
      const { updateGeneralSettingsAction } =
        await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
      const formData = new FormData()
      formData.set('site_name', 'Kuest')
      formData.set('site_description', 'Prediction market')
      formData.set('logo_mode', 'svg')
      formData.set(
        'logo_svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      )
      formData.set('logo_image_path', '')

      const result = await updateGeneralSettingsAction({ error: null }, formData)
      expect(result).toEqual({ error: null })
      expect(mocks.updateSettings).toHaveBeenCalledTimes(1)
    } finally {
    }
  })

  it('returns a form error when raster logo processing is unavailable', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
    void mock.module('sharp', () => {
      throw new Error('sharp missing')
    })

    try {
      const { updateGeneralSettingsAction } =
        await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
      const formData = new FormData()
      formData.set('site_name', 'Kuest')
      formData.set('site_description', 'Prediction market')
      formData.set('logo_mode', 'image')
      formData.set(
        'logo_svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      )
      formData.set('logo_image_path', '')
      formData.set('logo_image', new File(['png'], 'logo.png', { type: 'image/png' }))

      const result = await updateGeneralSettingsAction({ error: null }, formData)
      expect(result).toEqual({ error: 'Image processing is temporarily unavailable. Please try again later.' })
      expect(mocks.updateSettings).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it.each([
    {
      base64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      contentType: 'image/png',
      extension: 'png',
      label: 'PNG',
    },
    {
      base64: VALID_JPEG_BASE64,
      contentType: 'image/jpeg',
      extension: 'jpg',
      label: 'JPG',
    },
  ])('validates and uploads a $label side card image without loading sharp', async (sample) => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })
    void mock.module('sharp', () => {
      throw new Error('sharp should not load for side card uploads')
    })

    try {
      const { updateGeneralSettingsAction } =
        await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
      const formData = new FormData()
      formData.set('site_name', 'Kuest')
      formData.set('site_description', 'Prediction market')
      formData.set('logo_mode', 'svg')
      formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
      formData.set('logo_image_path', '')
      formData.set('home_featured_enabled', 'true')
      formData.set('home_featured_use_ai', 'false')
      formData.set('home_featured_max_cards', '6')
      formData.set('home_featured_default_context_mode', 'auto')
      formData.set('home_featured_news_sources', '')
      formData.set('home_featured_comment_blacklist', '')
      formData.set('home_featured_min_volume_24h', '0')
      formData.set('home_featured_include_sports_today', 'true')
      formData.set('home_featured_include_new_events', 'true')
      formData.set('home_featured_side_card_use_image', 'true')
      formData.set('home_featured_side_card_image_path', '')
      formData.set(
        'home_featured_side_card_image',
        new File([Buffer.from(sample.base64, 'base64')], `side-card.${sample.extension}`, { type: sample.contentType }),
      )

      const result = await updateGeneralSettingsAction({ error: null }, formData)

      expect(result).toEqual({ error: null })
      expect(mocks.upload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^home-featured/side-card-\\d+-[a-z0-9]+\\.${sample.extension}$`)),
        expect.any(Buffer),
        { contentType: sample.contentType, cacheControl: '31536000' },
      )

      const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ key: string; value: string }>
      expect(savedPayload.find((entry) => entry.key === 'side_card_use_image')?.value).toBe('true')
      expect(savedPayload.find((entry) => entry.key === 'side_card_image_path')?.value).toMatch(
        new RegExp(`^home-featured/side-card-\\d+-[a-z0-9]+\\.${sample.extension}$`),
      )
    } finally {
    }
  })

  it('preserves unfinished disabled media slides without requiring their media', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = buildHomeFeaturedFormData()
    formData.set(
      'home_featured_side_card_slides_json',
      JSON.stringify([
        {
          id: 'active-text',
          enabled: true,
          type: 'text',
          title: 'Market pulse',
          text: 'Fast movers across active markets.',
        },
        { id: 'image-draft', enabled: false, type: 'image', imagePath: '' },
        { id: 'video-draft', enabled: false, type: 'video', videoUrl: '' },
      ]),
    )

    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: null })
    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ key: string; value: string }>
    const savedSlides = JSON.parse(savedPayload.find((entry) => entry.key === 'side_card_slides_v1')?.value ?? '[]')
    expect(savedSlides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'image-draft', enabled: false, type: 'image', imagePath: '' }),
        expect.objectContaining({ id: 'video-draft', enabled: false, type: 'video', videoUrl: '' }),
      ]),
    )
  })

  it.each([
    {
      label: 'SOF component count',
      mutate: (buffer: Buffer) => {
        const markerOffset = buffer.indexOf(Buffer.from([0xff, 0xc0]))
        expect(markerOffset).toBeGreaterThanOrEqual(0)
        buffer[markerOffset + 9] = 4
      },
    },
    {
      label: 'SOS component count',
      mutate: (buffer: Buffer) => {
        const markerOffset = buffer.indexOf(Buffer.from([0xff, 0xda]))
        expect(markerOffset).toBeGreaterThanOrEqual(0)
        buffer[markerOffset + 4] = 4
      },
    },
  ])('rejects a JPEG with an invalid $label', async ({ mutate }) => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    const malformedJpeg = Buffer.from(VALID_JPEG_BASE64, 'base64')
    mutate(malformedJpeg)

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = buildSideCardImageFormData(new File([malformedJpeg], 'side-card.jpg', { type: 'image/jpeg' }))
    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: 'Side card image contents do not match its file type.' })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects a side card upload whose contents do not match its declared type', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set('home_featured_enabled', 'true')
    formData.set('home_featured_use_ai', 'false')
    formData.set('home_featured_max_cards', '6')
    formData.set('home_featured_default_context_mode', 'auto')
    formData.set('home_featured_news_sources', '')
    formData.set('home_featured_comment_blacklist', '')
    formData.set('home_featured_min_volume_24h', '0')
    formData.set('home_featured_include_sports_today', 'true')
    formData.set('home_featured_include_new_events', 'true')
    formData.set('home_featured_side_card_use_image', 'true')
    formData.set('home_featured_side_card_image_path', '')
    formData.set(
      'home_featured_side_card_image',
      new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'side-card.png', { type: 'image/png' }),
    )

    const result = await updateGeneralSettingsAction({ error: null }, formData)

    expect(result).toEqual({ error: 'Side card image contents do not match its file type.' })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('keeps featured markets saves successful when post-save revalidation fails', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error('revalidation failed')
    })
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { updateGeneralSettingsAction } =
        await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
      const formData = new FormData()
      formData.set('site_name', 'Kuest')
      formData.set('site_description', 'Prediction market')
      formData.set('logo_mode', 'svg')
      formData.set(
        'logo_svg',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      )
      formData.set('logo_image_path', '')
      formData.set('home_featured_events_json', '[]')

      const result = await updateGeneralSettingsAction({ error: null }, formData)
      expect(result).toEqual({ error: null })
      expect(mocks.replaceFeaturedEventsWithSettings).toHaveBeenCalledTimes(1)
      expect(mocks.updateSettings).not.toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('saves featured market context payloads without dropping the resolved event id', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('home_featured_enabled', 'true')
    formData.set('home_featured_use_ai', 'false')
    formData.set('home_featured_max_cards', '6')
    formData.set('home_featured_default_context_mode', 'auto')
    formData.set('home_featured_news_sources', '')
    formData.set('home_featured_comment_blacklist', '')
    formData.set('home_featured_min_volume_24h', '0')
    formData.set('home_featured_include_sports_today', 'true')
    formData.set('home_featured_include_new_events', 'true')
    formData.set('home_featured_side_card_title', 'Market pulse')
    formData.set('home_featured_side_card_text', 'Fast movers across active markets.')
    formData.set('home_featured_side_card_cta_label', '')
    formData.set('home_featured_side_card_cta_href', '')
    formData.set('home_featured_side_card_icon', 'trending-up')
    formData.set('home_featured_side_card_use_ai', 'false')
    formData.set(
      'home_featured_events_json',
      JSON.stringify([
        {
          targetType: 'series',
          eventId: '01HZY8N77WMQ2GZ8J3KQ6M4P9A',
          seriesSlug: 'nba-finals',
          enabled: true,
          rank: 0,
          source: 'manual',
          startsAt: null,
          endsAt: null,
          contextMode: 'auto',
          autoRolloverEnabled: true,
          contextLocale: 'pt',
          contextEventId: '01HZY8N77WMQ2GZ8J3KQ6M4P9A',
          contextItems: [
            {
              type: 'news',
              source: 'Example News',
              title: 'Preview article',
              url: 'https://news.example/article',
              faviconUrl: 'https://news.example/favicon.ico',
              publishedAt: '2026-07-05T12:00:00.000Z',
              relevanceScore: 1,
              expiresAt: '2027-07-05T12:00:00.000Z',
              isManual: true,
              locale: 'pt',
            },
          ],
        },
      ]),
    )

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.replaceFeaturedEventsWithSettings).toHaveBeenCalledTimes(1)

    const [featuredEventsPayload] = mocks.replaceFeaturedEventsWithSettings.mock.calls[0]
    expect(featuredEventsPayload[0]).toMatchObject({
      targetType: 'series',
      eventId: null,
      seriesSlug: 'nba-finals',
      contextEventId: '01HZY8N77WMQ2GZ8J3KQ6M4P9A',
      contextLocale: 'pt',
    })
    expect(featuredEventsPayload[0].contextItems[0]).toMatchObject({
      locale: 'pt',
      itemType: 'news',
      source: 'Example News',
      title: 'Preview article',
      url: 'https://news.example/article',
      faviconUrl: 'https://news.example/favicon.ico',
      isManual: true,
    })
    expect(featuredEventsPayload[0].contextItems[0].publishedAt).toBeInstanceOf(Date)
    expect(featuredEventsPayload[0].contextItems[0].expiresAt).toBeInstanceOf(Date)
  })

  it('saves image-mode settings when an image path already exists', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', 'theme/site-logo.png')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload.find((entry) => entry.key === 'site_logo_mode')?.value).toBe('image')
    expect(savedPayload.find((entry) => entry.key === 'site_logo_image_path')?.value).toBe('theme/site-logo.png')
  })

  it('does not overwrite integration settings when the General form omits them', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>')
    formData.set('logo_image_path', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string }>
    const movedIntegrationKeys = new Set([
      'site_google_analytics',
      'site_custom_javascript_codes',
      'lifi_integrator',
      'lifi_api_key',
      'arbitrage_enabled',
      'arbitrage_multi_wallet_enabled',
      'openrouter_model',
      'openrouter_api_key',
      'sports_pandascore_token',
      'sports_thesportsdb_api_key',
      'sumsub_enabled',
      'sumsub_app_token',
      'sumsub_secret_key',
      'sumsub_webhook_secret',
      'sumsub_level_name',
      'sumsub_enforcement',
    ])
    expect(savedPayload.filter((entry) => movedIntegrationKeys.has(entry.key))).toEqual([])
  })

  it('keeps the existing encrypted LI.FI key when no new key is provided', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        general: {
          lifi_api_key: { value: 'enc.v1.existing', updated_at: '2026-01-01T00:00:00.000Z' },
        },
        ai: {
          openrouter_api_key: { value: 'enc.v1.existing-openrouter', updated_at: '2026-01-01T00:00:00.000Z' },
        },
      },
      error: null,
    })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('lifi_integrator', 'kuest-fork')
    formData.set('lifi_api_key', '')
    formData.set('openrouter_api_key', '')
    formData.set('openrouter_model', '')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.encryptSecret).not.toHaveBeenCalled()

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload.find((entry) => entry.key === 'lifi_api_key')?.value).toBe('enc.v1.existing')
    expect(savedPayload.find((entry) => entry.group === 'ai' && entry.key === 'openrouter_api_key')?.value).toBe(
      'enc.v1.existing-openrouter',
    )
  })

  it('ignores unrelated extra form fields', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettings.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('unknown_field', 'ignored')

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })

    const savedPayload = mocks.updateSettings.mock.calls[0][0] as Array<{ group: string; key: string; value: string }>
    expect(savedPayload.some((entry) => entry.key === 'unknown_field')).toBe(false)
  })

  it('rejects unsupported logo upload types', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'image')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('logo_image', new File(['hello'], 'logo.txt', { type: 'text/plain' }))

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Logo must be PNG, JPG, WebP, or SVG.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('saves all Terms of Use translations when provided', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettingsWithTermsOfService.mockResolvedValueOnce({ data: [], error: null })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    const translations = {
      en: '# Kuest Terms of Use\n\nEnglish content.',
      de: '# Kuest Nutzungsbedingungen\n\nDeutscher Inhalt.',
      es: '# Términos de uso de Kuest\n\nContenido en español.',
      pt: '# Termos de Uso da Kuest\n\nConteúdo em português.',
      fr: '# Conditions d’utilisation de Kuest\n\nContenu français.',
      zh: '# Kuest 使用条款\n\n中文内容。',
      ja: '# Kuest 利用規約\n\n日本語の内容。',
      ar: '# شروط استخدام Kuest\n\nمحتوى عربي.',
      ru: '# Условия использования Kuest\n\nСодержимое на русском языке.',
      it: '# Termini di utilizzo di Kuest\n\nContenuto in italiano.',
      pl: '# Warunki korzystania z Kuest\n\nTreść po polsku.',
      ko: '# Kuest 이용약관\n\n한국어 콘텐츠.',
    }
    formData.set('terms_of_service_translations_json', JSON.stringify(translations))

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSettingsWithTermsOfService).toHaveBeenCalledWith(expect.any(Array), translations)
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('validates and saves only the enabled Terms of Use locales', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.getSettings.mockResolvedValueOnce({
      data: {
        i18n: {
          enabled_locales: { value: '["en","pt"]', updated_at: '' },
        },
      },
      error: null,
    })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set(
      'terms_of_service_translations_json',
      JSON.stringify({
        en: '# Terms of Use',
        pt: '# Termos de Uso',
      }),
    )

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: null })
    expect(mocks.updateSettingsWithTermsOfService).toHaveBeenCalledWith(expect.any(Array), {
      en: '# Terms of Use',
      pt: '# Termos de Uso',
    })
  })

  it('uses the atomic settings and Terms of Use save when it fails', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })
    mocks.updateSettingsWithTermsOfService.mockResolvedValueOnce({ data: null, error: 'save failed' })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set('logo_svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    formData.set('logo_image_path', '')
    formData.set(
      'terms_of_service_translations_json',
      JSON.stringify({
        en: '# Terms of Use',
        de: '# Nutzungsbedingungen',
        es: '# Términos de uso',
        pt: '# Termos de Uso',
        fr: '# Conditions d’utilisation',
        zh: '# 使用条款',
        ja: '# 利用規約',
        ar: '# شروط الاستخدام',
        ru: '# Условия использования',
        it: '# Termini di utilizzo',
        pl: '# Warunki korzystania',
        ko: '# 이용약관',
      }),
    )

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Internal server error. Try again in a few moments.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects incomplete Terms of Use translations', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'admin-1', is_admin: true })

    const { updateGeneralSettingsAction } =
      await import('@/app/[locale]/admin/(general)/_actions/update-general-settings')
    const formData = new FormData()
    formData.set('site_name', 'Kuest')
    formData.set('site_description', 'Prediction market')
    formData.set('logo_mode', 'svg')
    formData.set(
      'logo_svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    )
    formData.set('logo_image_path', '')
    formData.set('fee_recipient_wallet', '0x1111111111111111111111111111111111111111')
    formData.set('terms_of_service_translations_json', JSON.stringify({ en: '# Terms of Use' }))

    const result = await updateGeneralSettingsAction({ error: null }, formData)
    expect(result).toEqual({ error: 'Terms of Use content is missing for de.' })
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })
})
