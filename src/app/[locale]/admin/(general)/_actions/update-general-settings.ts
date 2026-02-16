'use server'

import { Buffer } from 'node:buffer'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { encryptSecret } from '@/lib/encryption'
import { supabaseAdmin } from '@/lib/supabase'
import { validateThemeSiteSettingsInput } from '@/lib/theme-settings'

const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_PWA_ICON_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_PWA_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']

export interface GeneralSettingsActionState {
  error: string | null
}

function buildThemeAssetPath(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8)
  return `theme/${prefix}-${Date.now()}-${random}.png`
}

async function processThemeLogoFile(file: File) {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    return { mode: null, path: null, svg: null, error: 'Logo must be PNG, JPG, WebP, or SVG.' }
  }

  if (file.size > MAX_LOGO_FILE_SIZE) {
    return { mode: null, path: null, svg: null, error: 'Logo image must be 2MB or smaller.' }
  }

  if (file.type === 'image/svg+xml') {
    const svg = await file.text()
    return { mode: 'svg' as const, path: null, svg, error: null }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const output = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer()

  const filePath = buildThemeAssetPath('site-logo')

  const { error } = await supabaseAdmin.storage
    .from('kuest-assets')
    .upload(filePath, output, {
      contentType: 'image/png',
      cacheControl: '31536000',
    })

  if (error) {
    return { mode: null, path: null, svg: null, error: DEFAULT_ERROR_MESSAGE }
  }

  return { mode: 'image' as const, path: filePath, svg: null, error: null }
}

async function processPwaIconFile(file: File, size: number, label: string) {
  if (!ACCEPTED_PWA_ICON_TYPES.includes(file.type)) {
    return { path: null as string | null, error: `${label} must be PNG, JPG, WebP, or SVG.` }
  }

  if (file.size > MAX_PWA_ICON_FILE_SIZE) {
    return { path: null as string | null, error: `${label} must be 2MB or smaller.` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const output = await sharp(buffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ quality: 92 })
    .toBuffer()

  const filePath = buildThemeAssetPath(`pwa-icon-${size}`)
  const { error } = await supabaseAdmin.storage
    .from('kuest-assets')
    .upload(filePath, output, {
      contentType: 'image/png',
      cacheControl: '31536000',
    })

  if (error) {
    return { path: null as string | null, error: DEFAULT_ERROR_MESSAGE }
  }

  return { path: filePath, error: null as string | null }
}

export async function updateGeneralSettingsAction(
  _prevState: GeneralSettingsActionState,
  formData: FormData,
): Promise<GeneralSettingsActionState> {
  const user = await UserRepository.getCurrentUser()
  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const siteNameRaw = formData.get('site_name')
  const siteDescriptionRaw = formData.get('site_description')
  const logoModeRaw = formData.get('logo_mode')
  const logoSvgRaw = formData.get('logo_svg')
  const logoImagePathRaw = formData.get('logo_image_path')
  const pwaIcon192PathRaw = formData.get('pwa_icon_192_path')
  const pwaIcon512PathRaw = formData.get('pwa_icon_512_path')
  const logoFileRaw = formData.get('logo_image')
  const pwaIcon192FileRaw = formData.get('pwa_icon_192')
  const pwaIcon512FileRaw = formData.get('pwa_icon_512')
  const googleAnalyticsIdRaw = formData.get('google_analytics_id')
  const discordLinkRaw = formData.get('discord_link')
  const supportUrlRaw = formData.get('support_url')
  const feeRecipientWalletRaw = formData.get('fee_recipient_wallet')
  const marketCreatorsRaw = formData.get('market_creators')
  const lifiIntegratorRaw = formData.get('lifi_integrator')
  const lifiApiKeyRaw = formData.get('lifi_api_key')
  const openRouterModelRaw = formData.get('openrouter_model')
  const openRouterApiKeyRaw = formData.get('openrouter_api_key')

  const siteName = typeof siteNameRaw === 'string' ? siteNameRaw : ''
  const siteDescription = typeof siteDescriptionRaw === 'string' ? siteDescriptionRaw : ''
  let logoMode = typeof logoModeRaw === 'string' ? logoModeRaw : ''
  let logoSvg = typeof logoSvgRaw === 'string' ? logoSvgRaw : ''
  let logoImagePath = typeof logoImagePathRaw === 'string' ? logoImagePathRaw : ''
  let pwaIcon192Path = typeof pwaIcon192PathRaw === 'string' ? pwaIcon192PathRaw : ''
  let pwaIcon512Path = typeof pwaIcon512PathRaw === 'string' ? pwaIcon512PathRaw : ''
  const googleAnalyticsId = typeof googleAnalyticsIdRaw === 'string' ? googleAnalyticsIdRaw : ''
  const discordLink = typeof discordLinkRaw === 'string' ? discordLinkRaw : ''
  const supportUrl = typeof supportUrlRaw === 'string' ? supportUrlRaw : ''
  const feeRecipientWallet = typeof feeRecipientWalletRaw === 'string' ? feeRecipientWalletRaw : ''
  const marketCreators = typeof marketCreatorsRaw === 'string' ? marketCreatorsRaw : ''
  const lifiIntegrator = typeof lifiIntegratorRaw === 'string' ? lifiIntegratorRaw : ''
  const lifiApiKey = typeof lifiApiKeyRaw === 'string' ? lifiApiKeyRaw : ''
  const openRouterModel = typeof openRouterModelRaw === 'string' ? openRouterModelRaw.trim() : ''
  const openRouterApiKey = typeof openRouterApiKeyRaw === 'string' ? openRouterApiKeyRaw.trim() : ''

  if (openRouterModel.length > 160) {
    return { error: 'OpenRouter model is too long.' }
  }

  if (openRouterApiKey.length > 256) {
    return { error: 'OpenRouter API key is too long.' }
  }

  if (logoFileRaw instanceof File && logoFileRaw.size > 0) {
    const processed = await processThemeLogoFile(logoFileRaw)
    if (!processed.mode) {
      return { error: processed.error ?? DEFAULT_ERROR_MESSAGE }
    }

    if (processed.mode === 'svg') {
      logoMode = 'svg'
      logoSvg = processed.svg ?? ''
      logoImagePath = ''
    }
    else {
      logoMode = 'image'
      logoImagePath = processed.path ?? logoImagePath
    }
  }

  if (pwaIcon192FileRaw instanceof File && pwaIcon192FileRaw.size > 0) {
    const processed = await processPwaIconFile(pwaIcon192FileRaw, 192, 'PWA icon (192x192)')
    if (!processed.path) {
      return { error: processed.error ?? DEFAULT_ERROR_MESSAGE }
    }
    pwaIcon192Path = processed.path
  }

  if (pwaIcon512FileRaw instanceof File && pwaIcon512FileRaw.size > 0) {
    const processed = await processPwaIconFile(pwaIcon512FileRaw, 512, 'PWA icon (512x512)')
    if (!processed.path) {
      return { error: processed.error ?? DEFAULT_ERROR_MESSAGE }
    }
    pwaIcon512Path = processed.path
  }

  const validated = validateThemeSiteSettingsInput({
    siteName,
    siteDescription,
    logoMode,
    logoSvg,
    logoImagePath,
    pwaIcon192Path,
    pwaIcon512Path,
    googleAnalyticsId,
    discordLink,
    supportUrl,
    feeRecipientWallet,
    marketCreators,
    lifiIntegrator,
    lifiApiKey,
  })

  if (!validated.data) {
    return { error: validated.error ?? 'Invalid input.' }
  }

  let encryptedLiFiApiKey = ''
  let encryptedOpenRouterApiKey = ''
  try {
    const { data: allSettings, error: settingsError } = await SettingsRepository.getSettings()
    if (settingsError) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    const existingEncryptedLiFiApiKey = allSettings?.general?.lifi_api_key?.value ?? ''
    const existingEncryptedOpenRouterApiKey = allSettings?.ai?.openrouter_api_key?.value ?? ''
    encryptedLiFiApiKey = validated.data.lifiApiKeyValue
      ? encryptSecret(validated.data.lifiApiKeyValue)
      : existingEncryptedLiFiApiKey
    encryptedOpenRouterApiKey = openRouterApiKey
      ? encryptSecret(openRouterApiKey)
      : existingEncryptedOpenRouterApiKey
  }
  catch (error) {
    console.error('Failed to encrypt API keys', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const { error } = await SettingsRepository.updateSettings([
    { group: 'general', key: 'site_name', value: validated.data.siteNameValue },
    { group: 'general', key: 'site_description', value: validated.data.siteDescriptionValue },
    { group: 'general', key: 'site_logo_mode', value: validated.data.logoModeValue },
    { group: 'general', key: 'site_logo_svg', value: validated.data.logoSvgValue },
    { group: 'general', key: 'site_logo_image_path', value: validated.data.logoImagePathValue },
    { group: 'general', key: 'pwa_icon_192_path', value: validated.data.pwaIcon192PathValue },
    { group: 'general', key: 'pwa_icon_512_path', value: validated.data.pwaIcon512PathValue },
    { group: 'general', key: 'site_google_analytics', value: validated.data.googleAnalyticsIdValue },
    { group: 'general', key: 'site_discord_link', value: validated.data.discordLinkValue },
    { group: 'general', key: 'site_support_url', value: validated.data.supportUrlValue },
    { group: 'general', key: 'fee_recipient_wallet', value: validated.data.feeRecipientWalletValue },
    { group: 'general', key: 'market_creators', value: validated.data.marketCreatorsValue },
    { group: 'general', key: 'lifi_integrator', value: validated.data.lifiIntegratorValue },
    { group: 'general', key: 'lifi_api_key', value: encryptedLiFiApiKey },
    { group: 'ai', key: 'openrouter_model', value: openRouterModel },
    { group: 'ai', key: 'openrouter_api_key', value: encryptedOpenRouterApiKey },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/[locale]/admin', 'page')
  revalidatePath('/[locale]/admin/theme', 'page')
  revalidatePath('/[locale]/admin/market-context', 'page')
  revalidatePath('/[locale]', 'layout')

  return { error: null }
}
