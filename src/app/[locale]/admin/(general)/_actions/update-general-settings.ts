'use server'

import type { SupportedLocale } from '@/i18n/locales'
import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'
import { getLocale } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { validateMarketContextSettingsInput } from '@/lib/ai/market-context-config'
import {
  ARBITRAGE_ENABLED_SETTINGS_KEY,
  ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY,
  ARBITRAGE_SETTINGS_GROUP,
} from '@/lib/arbitrage-settings'
import { cacheTags } from '@/lib/cache-tags'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { encryptSecret } from '@/lib/encryption'
import {
  BLOCKED_COUNTRIES_SETTINGS_KEY,
  validateBlockedCountriesInput,
} from '@/lib/geoblock-settings'
import {
  GLOBAL_ANNOUNCEMENT_DISABLE_FAUCET_BANNER_KEY,
  GLOBAL_ANNOUNCEMENT_DISABLED_ON_KEY,
  GLOBAL_ANNOUNCEMENT_LINK_URL_KEY,
  GLOBAL_ANNOUNCEMENT_MESSAGE_KEY,
  validateGlobalAnnouncementInput,
} from '@/lib/global-announcement-settings'
import {
  buildHomeFeaturedSettingsUpdateRows,
  parseHomeFeaturedEventsPayload,
} from '@/lib/home-featured-admin'
import {
  validateHomeFeaturedSettingsInput,
} from '@/lib/home-featured-settings'
import { reportOperatorDomainSnapshot } from '@/lib/operator-domain-register'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import resolveSiteUrl from '@/lib/site-url'
import { uploadPublicAsset } from '@/lib/storage'
import { normalizeTermsOfServicePdfPath, TERMS_OF_SERVICE_PDF_PATH_KEY } from '@/lib/terms-of-service'
import { validateThemeSiteSettingsInput } from '@/lib/theme-settings'

const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_PWA_ICON_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_PWA_ICON_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_SIDE_CARD_IMAGE_FILE_SIZE = 2 * 1024 * 1024
const MAX_SIDE_CARD_IMAGE_PIXELS = 40_000_000
const MAX_SIDE_CARD_IMAGE_DECODED_BYTES = 64 * 1024 * 1024
const ACCEPTED_SIDE_CARD_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg']
const MAX_TERMS_OF_SERVICE_PDF_FILE_SIZE = 2 * 1024 * 1024
export interface GeneralSettingsActionState {
  error: string | null
}

function buildThemeAssetPath(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8)
  return `theme/${prefix}-${Date.now()}-${random}.png`
}

function buildTermsOfServicePdfPath() {
  const random = Math.random().toString(36).slice(2, 8)
  return `legal/terms-of-service-${Date.now()}-${random}.pdf`
}

type SideCardImageExtension = 'jpg' | 'png'

function buildSideCardImagePath(extension: SideCardImageExtension) {
  const random = Math.random().toString(36).slice(2, 8)
  return `home-featured/side-card-${Date.now()}-${random}.${extension}`
}

function hasValidSideCardDimensions(width: number, height: number) {
  return width > 0
    && height > 0
    && width <= Math.floor(MAX_SIDE_CARD_IMAGE_PIXELS / height)
}

function calculatePngCrc(buffer: Buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function calculatePngDecodedLength(width: number, height: number, bitsPerPixel: number, interlace: number) {
  if (interlace === 0) {
    return height * (1 + Math.ceil((width * bitsPerPixel) / 8))
  }

  const starts = [[0, 0], [4, 0], [0, 4], [2, 0], [0, 2], [1, 0], [0, 1]]
  const steps = [[8, 8], [8, 8], [4, 8], [4, 4], [2, 4], [2, 2], [1, 2]]
  return starts.reduce((total, [startX, startY], index) => {
    const [stepX, stepY] = steps[index]!
    const passWidth = width > startX ? Math.ceil((width - startX) / stepX) : 0
    const passHeight = height > startY ? Math.ceil((height - startY) / stepY) : 0
    return total + (passWidth && passHeight ? passHeight * (1 + Math.ceil((passWidth * bitsPerPixel) / 8)) : 0)
  }, 0)
}

function hasValidPngScanlineFilters(decoded: Buffer, width: number, height: number, bitsPerPixel: number, interlace: number) {
  const starts = interlace === 0 ? [[0, 0]] : [[0, 0], [4, 0], [0, 4], [2, 0], [0, 2], [1, 0], [0, 1]]
  const steps = interlace === 0 ? [[1, 1]] : [[8, 8], [8, 8], [4, 8], [4, 4], [2, 4], [2, 2], [1, 2]]
  let offset = 0

  for (let index = 0; index < starts.length; index += 1) {
    const [startX, startY] = starts[index]!
    const [stepX, stepY] = steps[index]!
    const passWidth = width > startX ? Math.ceil((width - startX) / stepX) : 0
    const passHeight = height > startY ? Math.ceil((height - startY) / stepY) : 0
    const rowLength = Math.ceil((passWidth * bitsPerPixel) / 8)
    for (let row = 0; row < passHeight; row += 1) {
      if ((decoded[offset] ?? 5) > 4) {
        return false
      }
      offset += rowLength + 1
    }
  }

  return offset === decoded.length
}

function isStructurallyValidPng(buffer: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(signature)) {
    return false
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitsPerPixel = 0
  let interlace = 0
  let colorType = -1
  let sawHeader = false
  let sawPalette = false
  let sawImageData = false
  let imageDataEnded = false
  let sawEnd = false
  const imageData: Buffer[] = []
  const channelsByColorType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
  const bitDepthsByColorType: Record<number, number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  }

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      return false
    }
    const dataLength = buffer.readUInt32BE(offset)
    const typeStart = offset + 4
    const dataStart = typeStart + 4
    const dataEnd = dataStart + dataLength
    const chunkEnd = dataEnd + 4
    if (chunkEnd > buffer.length) {
      return false
    }

    const typeBuffer = buffer.subarray(typeStart, dataStart)
    const type = typeBuffer.toString('ascii')
    const data = buffer.subarray(dataStart, dataEnd)
    if (!/^[a-z]{4}$/i.test(type)
      || calculatePngCrc(Buffer.concat([typeBuffer, data])) !== buffer.readUInt32BE(dataEnd)) {
      return false
    }
    if (!sawHeader && type !== 'IHDR') {
      return false
    }

    if (type === 'IHDR') {
      if (sawHeader || dataLength !== 13) {
        return false
      }
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const bitDepth = data[8] ?? 0
      colorType = data[9] ?? -1
      const channels = channelsByColorType[colorType]
      if (!hasValidSideCardDimensions(width, height)
        || !channels
        || !bitDepthsByColorType[colorType]?.includes(bitDepth)
        || data[10] !== 0
        || data[11] !== 0
        || (data[12] !== 0 && data[12] !== 1)) {
        return false
      }
      bitsPerPixel = channels * bitDepth
      interlace = data[12]
      sawHeader = true
    }
    else if (type === 'PLTE') {
      if (sawPalette || sawImageData || dataLength === 0 || dataLength > 768 || dataLength % 3 !== 0 || colorType === 0 || colorType === 4) {
        return false
      }
      sawPalette = true
    }
    else if (type === 'IDAT') {
      if (!sawHeader || imageDataEnded || (colorType === 3 && !sawPalette)) {
        return false
      }
      sawImageData = true
      imageData.push(Buffer.from(data))
    }
    else if (type === 'IEND') {
      if (!sawImageData || dataLength !== 0 || chunkEnd !== buffer.length) {
        return false
      }
      sawEnd = true
    }
    else {
      if (sawImageData) {
        imageDataEnded = true
      }
      if (type[0] === type[0]?.toUpperCase()) {
        return false
      }
    }

    offset = chunkEnd
  }

  if (!sawHeader || !sawImageData || !sawEnd) {
    return false
  }

  const decodedLength = calculatePngDecodedLength(width, height, bitsPerPixel, interlace)
  if (decodedLength > MAX_SIDE_CARD_IMAGE_DECODED_BYTES) {
    return false
  }
  try {
    const decoded = inflateSync(Buffer.concat(imageData), { maxOutputLength: decodedLength + 1 })
    return decoded.length === decodedLength
      && hasValidPngScanlineFilters(decoded, width, height, bitsPerPixel, interlace)
  }
  catch {
    return false
  }
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xC0,
  0xC1,
  0xC2,
  0xC3,
  0xC5,
  0xC6,
  0xC7,
  0xC9,
  0xCA,
  0xCB,
  0xCD,
  0xCE,
  0xCF,
])

function isStructurallyValidJpeg(buffer: Buffer) {
  if (buffer.length < 16 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return false
  }

  let offset = 2
  let sawFrame = false
  let sawScan = false
  let frameMarker: number | null = null
  let frameComponentIds: Set<number> | null = null
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      return false
    }
    while (buffer[offset] === 0xFF) {
      offset += 1
    }
    const marker = buffer[offset]
    if (marker === undefined || marker === 0x00 || marker === 0xD8) {
      return false
    }
    offset += 1

    if (marker === 0xD9) {
      return sawFrame && sawScan && offset === buffer.length
    }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue
    }
    if (offset + 2 > buffer.length) {
      return false
    }

    const segmentLength = buffer.readUInt16BE(offset)
    const segmentEnd = offset + segmentLength
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      return false
    }

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      const componentCount = buffer[offset + 7] ?? 0
      if (sawFrame
        || componentCount < 1
        || componentCount > 4
        || segmentLength !== 8 + 3 * componentCount) {
        return false
      }
      const height = buffer.readUInt16BE(offset + 3)
      const width = buffer.readUInt16BE(offset + 5)
      if (!hasValidSideCardDimensions(width, height)) {
        return false
      }

      const componentIds = new Set<number>()
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = offset + 8 + index * 3
        const componentId = buffer[componentOffset]
        const sampling = buffer[componentOffset + 1] ?? 0
        const quantizationTable = buffer[componentOffset + 2] ?? 4
        const horizontalSampling = sampling >>> 4
        const verticalSampling = sampling & 0x0F
        if (componentId === undefined
          || componentIds.has(componentId)
          || horizontalSampling < 1
          || horizontalSampling > 4
          || verticalSampling < 1
          || verticalSampling > 4
          || quantizationTable > 3) {
          return false
        }
        componentIds.add(componentId)
      }

      sawFrame = true
      frameMarker = marker
      frameComponentIds = componentIds
    }

    if (marker !== 0xDA) {
      offset = segmentEnd
      continue
    }

    const scanComponentCount = buffer[offset + 2] ?? 0
    if (!sawFrame
      || !frameComponentIds
      || scanComponentCount < 1
      || scanComponentCount > frameComponentIds.size
      || segmentLength !== 6 + 2 * scanComponentCount) {
      return false
    }

    const scanComponentIds = new Set<number>()
    for (let index = 0; index < scanComponentCount; index += 1) {
      const componentOffset = offset + 3 + index * 2
      const componentId = buffer[componentOffset]
      const tableSelectors = buffer[componentOffset + 1] ?? 0xFF
      if (componentId === undefined
        || !frameComponentIds.has(componentId)
        || scanComponentIds.has(componentId)
        || (tableSelectors >>> 4) > 3
        || (tableSelectors & 0x0F) > 3) {
        return false
      }
      scanComponentIds.add(componentId)
    }

    const spectralOffset = offset + 3 + scanComponentCount * 2
    const spectralStart = buffer[spectralOffset] ?? 64
    const spectralEnd = buffer[spectralOffset + 1] ?? 64
    const successiveApproximation = buffer[spectralOffset + 2] ?? 0xFF
    if (spectralStart > 63
      || spectralEnd > 63
      || (successiveApproximation >>> 4) > 13
      || (successiveApproximation & 0x0F) > 13
      || (frameMarker === 0xC0 && (spectralStart !== 0 || spectralEnd !== 63 || successiveApproximation !== 0))) {
      return false
    }

    sawScan = true
    offset = segmentEnd
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) {
        offset += 1
        continue
      }
      const next = buffer[offset + 1]
      if (next === 0x00 || (next !== undefined && next >= 0xD0 && next <= 0xD7)) {
        offset += 2
        continue
      }
      if (next === 0xFF) {
        offset += 1
        continue
      }
      break
    }
  }

  return false
}

function detectSideCardImageType(buffer: Buffer): {
  contentType: 'image/jpeg' | 'image/png'
  extension: SideCardImageExtension
} | null {
  if (isStructurallyValidPng(buffer)) {
    return { contentType: 'image/png', extension: 'png' }
  }

  if (isStructurallyValidJpeg(buffer)) {
    return { contentType: 'image/jpeg', extension: 'jpg' }
  }

  return null
}

async function loadSharp() {
  try {
    const sharpModule = await import('sharp')
    return { sharp: sharpModule.default, error: null }
  }
  catch (error) {
    console.error('Failed to load sharp for admin image processing', error)
    return { sharp: null, error: 'Image processing is temporarily unavailable. Please try again later.' }
  }
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

  const { sharp, error: sharpError } = await loadSharp()
  if (!sharp) {
    return { mode: null, path: null, svg: null, error: sharpError ?? DEFAULT_ERROR_MESSAGE }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const output = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer()

  const filePath = buildThemeAssetPath('site-logo')

  const { error } = await uploadPublicAsset(filePath, output, {
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

  const { sharp, error: sharpError } = await loadSharp()
  if (!sharp) {
    return { path: null as string | null, error: sharpError ?? DEFAULT_ERROR_MESSAGE }
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
  const { error } = await uploadPublicAsset(filePath, output, {
    contentType: 'image/png',
    cacheControl: '31536000',
  })

  if (error) {
    return { path: null as string | null, error: DEFAULT_ERROR_MESSAGE }
  }

  return { path: filePath, error: null as string | null }
}

async function processSideCardImageFile(file: File) {
  if (!ACCEPTED_SIDE_CARD_IMAGE_TYPES.includes(file.type)) {
    return { path: null as string | null, error: 'Side card image must be PNG or JPG.' }
  }

  if (file.size > MAX_SIDE_CARD_IMAGE_FILE_SIZE) {
    return { path: null as string | null, error: 'Side card image must be 2MB or smaller.' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const imageType = detectSideCardImageType(buffer)
    const declaredType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
    if (!imageType || imageType.contentType !== declaredType) {
      return { path: null as string | null, error: 'Side card image contents do not match its file type.' }
    }

    const filePath = buildSideCardImagePath(imageType.extension)
    const { error } = await uploadPublicAsset(filePath, buffer, {
      contentType: imageType.contentType,
      cacheControl: '31536000',
    })

    return error
      ? { path: null as string | null, error: DEFAULT_ERROR_MESSAGE }
      : { path: filePath, error: null as string | null }
  }
  catch (error) {
    console.error('Failed to upload side card image', error)
    return { path: null as string | null, error: 'Side card image could not be uploaded.' }
  }
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.trim().toLowerCase().endsWith('.pdf')
}

async function processTermsOfServicePdfFile(file: File) {
  if (!isPdfFile(file)) {
    return { path: null as string | null, error: 'Terms of Use PDF must be a PDF file.' }
  }

  if (file.size > MAX_TERMS_OF_SERVICE_PDF_FILE_SIZE) {
    return { path: null as string | null, error: 'Terms of Use PDF must be 2MB or smaller.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = buildTermsOfServicePdfPath()
  const { error } = await uploadPublicAsset(filePath, buffer, {
    contentType: 'application/pdf',
    cacheControl: '31536000',
  })

  if (error) {
    return { path: null as string | null, error: DEFAULT_ERROR_MESSAGE }
  }

  return { path: filePath, error: null as string | null }
}

async function updateCacheTag(tag: string) {
  try {
    const cache = await import('next/cache')
    if (typeof cache.updateTag === 'function') {
      cache.updateTag(tag)
    }
  }
  catch {}
}

async function revalidateGeneralSettingsPaths() {
  await updateCacheTag(cacheTags.settings)
  await updateCacheTag(cacheTags.homeFeaturedEvents)
  revalidatePath('/[locale]/admin', 'page')
  revalidatePath('/[locale]/admin/theme', 'page')
  revalidatePath('/[locale]/tos', 'page')
  revalidatePath('/[locale]', 'page')
  revalidatePath('/', 'page')
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}`, 'page')
  }
}

async function revalidateMarketContextPaths() {
  revalidatePath('/[locale]/event/[slug]', 'page')
  revalidatePath('/[locale]/event/[slug]/[market]', 'page')
  revalidatePath('/[locale]/sports/[sport]/[event]', 'page')
  revalidatePath('/[locale]/sports/[sport]/[event]/[market]', 'page')
  revalidatePath('/[locale]/esports/[sport]/[...slugParts]', 'page')
}

async function runOptionalGeneralSettingsTask(label: string, task: () => Promise<void>) {
  try {
    await task()
  }
  catch (error) {
    console.error(`Failed to ${label}`, error)
  }
}

async function syncGeoblockSettings() {
  const { geoblockUrl } = resolvePublicRuntimeEnv(process.env)
  const response = await fetch(geoblockUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: resolveSiteUrl(process.env),
    }),
    cache: 'no-store',
  })

  if (response.ok) {
    return
  }

  const payload = await response.json().catch(() => null) as { error?: string, detail?: string } | null
  const detail = payload?.detail || payload?.error
  throw new Error(detail || `Geoblock sync failed with status ${response.status}.`)
}

async function resolveCurrentLocale(): Promise<SupportedLocale> {
  try {
    const locale = await getLocale()
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
      ? locale as SupportedLocale
      : DEFAULT_LOCALE
  }
  catch {
    return DEFAULT_LOCALE
  }
}

async function updateGeneralSettingsActionImpl(
  _prevState: GeneralSettingsActionState,
  formData: FormData,
): Promise<GeneralSettingsActionState> {
  const user = await UserRepository.getCurrentUser({ minimal: true })
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
  const twitterLinkRaw = formData.get('twitter_link')
  const facebookLinkRaw = formData.get('facebook_link')
  const instagramLinkRaw = formData.get('instagram_link')
  const tiktokLinkRaw = formData.get('tiktok_link')
  const linkedinLinkRaw = formData.get('linkedin_link')
  const youtubeLinkRaw = formData.get('youtube_link')
  const supportUrlRaw = formData.get('support_url')
  const globalAnnouncementMessageRaw = formData.get('global_announcement_message')
  const globalAnnouncementLinkUrlRaw = formData.get('global_announcement_link_url')
  const globalAnnouncementDisabledOnJsonRaw = formData.get('global_announcement_disabled_on_json')
  const globalAnnouncementDisableFaucetBannerRaw = formData.get('global_announcement_disable_faucet_banner')
  const customJavascriptCodesJsonRaw = formData.get('custom_javascript_codes_json')
  const tosPdfPathRaw = formData.get('tos_pdf_path')
  const tosPdfFileRaw = formData.get('tos_pdf')
  const lifiIntegratorRaw = formData.get('lifi_integrator')
  const lifiApiKeyRaw = formData.get('lifi_api_key')
  const arbitrageEnabledRaw = formData.get('arbitrage_enabled')
  const arbitrageMultiWalletEnabledRaw = formData.get('arbitrage_multi_wallet_enabled')
  const openRouterModelRaw = formData.get('openrouter_model')
  const openRouterApiKeyRaw = formData.get('openrouter_api_key')
  const marketContextEnabledRaw = formData.get('market_context_enabled')
  const marketContextPromptRaw = formData.get('market_context_prompt')
  const sportsPandaScoreTokenRaw = formData.get('sports_pandascore_token')
  const sportsTheSportsDbApiKeyRaw = formData.get('sports_thesportsdb_api_key')
  const blockedCountriesRaw = formData.get('blocked_countries')
  const homeFeaturedEnabledRaw = formData.get('home_featured_enabled')
  const homeFeaturedUseAiRaw = formData.get('home_featured_use_ai')
  const homeFeaturedMaxCardsRaw = formData.get('home_featured_max_cards')
  const homeFeaturedDefaultContextModeRaw = formData.get('home_featured_default_context_mode')
  const homeFeaturedNewsSourcesRaw = formData.get('home_featured_news_sources')
  const homeFeaturedCommentBlacklistRaw = formData.get('home_featured_comment_blacklist')
  const homeFeaturedMinVolume24hRaw = formData.get('home_featured_min_volume_24h')
  const homeFeaturedIncludeSportsTodayRaw = formData.get('home_featured_include_sports_today')
  const homeFeaturedIncludeNewEventsRaw = formData.get('home_featured_include_new_events')
  const homeFeaturedSideCardTitleRaw = formData.get('home_featured_side_card_title')
  const homeFeaturedSideCardTextRaw = formData.get('home_featured_side_card_text')
  const homeFeaturedSideCardCtaLabelRaw = formData.get('home_featured_side_card_cta_label')
  const homeFeaturedSideCardCtaHrefRaw = formData.get('home_featured_side_card_cta_href')
  const homeFeaturedSideCardIconRaw = formData.get('home_featured_side_card_icon')
  const homeFeaturedSideCardUseAiRaw = formData.get('home_featured_side_card_use_ai')
  const homeFeaturedSideCardUseImageRaw = formData.get('home_featured_side_card_use_image')
  const homeFeaturedSideCardImagePathRaw = formData.get('home_featured_side_card_image_path')
  const homeFeaturedSideCardImageFileRaw = formData.get('home_featured_side_card_image')
  const homeFeaturedEventsJsonRaw = formData.get('home_featured_events_json')
  const hasMarketContextPayload = typeof marketContextEnabledRaw === 'string'
    && typeof marketContextPromptRaw === 'string'
  const hasHomeFeaturedSettingsPayload = typeof homeFeaturedEnabledRaw === 'string'
  const hasHomeFeaturedEventsPayload = typeof homeFeaturedEventsJsonRaw === 'string'

  const siteName = typeof siteNameRaw === 'string' ? siteNameRaw : ''
  const siteDescription = typeof siteDescriptionRaw === 'string' ? siteDescriptionRaw : ''
  let logoMode = typeof logoModeRaw === 'string' ? logoModeRaw : ''
  let logoSvg = typeof logoSvgRaw === 'string' ? logoSvgRaw : ''
  let logoImagePath = typeof logoImagePathRaw === 'string' ? logoImagePathRaw : ''
  let pwaIcon192Path = typeof pwaIcon192PathRaw === 'string' ? pwaIcon192PathRaw : ''
  let pwaIcon512Path = typeof pwaIcon512PathRaw === 'string' ? pwaIcon512PathRaw : ''
  const googleAnalyticsId = typeof googleAnalyticsIdRaw === 'string' ? googleAnalyticsIdRaw : ''
  const discordLink = typeof discordLinkRaw === 'string' ? discordLinkRaw : ''
  const twitterLink = typeof twitterLinkRaw === 'string' ? twitterLinkRaw : ''
  const facebookLink = typeof facebookLinkRaw === 'string' ? facebookLinkRaw : ''
  const instagramLink = typeof instagramLinkRaw === 'string' ? instagramLinkRaw : ''
  const tiktokLink = typeof tiktokLinkRaw === 'string' ? tiktokLinkRaw : ''
  const linkedinLink = typeof linkedinLinkRaw === 'string' ? linkedinLinkRaw : ''
  const youtubeLink = typeof youtubeLinkRaw === 'string' ? youtubeLinkRaw : ''
  const supportUrl = typeof supportUrlRaw === 'string' ? supportUrlRaw : ''
  const globalAnnouncementMessage = typeof globalAnnouncementMessageRaw === 'string' ? globalAnnouncementMessageRaw : ''
  const globalAnnouncementLinkUrl = typeof globalAnnouncementLinkUrlRaw === 'string' ? globalAnnouncementLinkUrlRaw : ''
  const globalAnnouncementDisabledOnJson = typeof globalAnnouncementDisabledOnJsonRaw === 'string'
    ? globalAnnouncementDisabledOnJsonRaw
    : ''
  const globalAnnouncementDisableFaucetBanner = typeof globalAnnouncementDisableFaucetBannerRaw === 'string'
    ? globalAnnouncementDisableFaucetBannerRaw
    : ''
  const customJavascriptCodesJson = typeof customJavascriptCodesJsonRaw === 'string' ? customJavascriptCodesJsonRaw : ''
  let tosPdfPath = typeof tosPdfPathRaw === 'string' ? tosPdfPathRaw : ''
  const lifiIntegrator = typeof lifiIntegratorRaw === 'string' ? lifiIntegratorRaw : ''
  const lifiApiKey = typeof lifiApiKeyRaw === 'string' ? lifiApiKeyRaw : ''
  const openRouterModel = typeof openRouterModelRaw === 'string' ? openRouterModelRaw.trim() : ''
  const openRouterApiKey = typeof openRouterApiKeyRaw === 'string' ? openRouterApiKeyRaw.trim() : ''
  const sportsPandaScoreToken = typeof sportsPandaScoreTokenRaw === 'string' ? sportsPandaScoreTokenRaw.trim() : ''
  const sportsTheSportsDbApiKey = typeof sportsTheSportsDbApiKeyRaw === 'string' ? sportsTheSportsDbApiKeyRaw.trim() : ''
  const blockedCountriesInput = typeof blockedCountriesRaw === 'string' ? blockedCountriesRaw : ''
  const homeFeaturedEventsJson = typeof homeFeaturedEventsJsonRaw === 'string' ? homeFeaturedEventsJsonRaw : ''

  if (openRouterModel.length > 160) {
    return { error: 'OpenRouter model is too long.' }
  }

  if (openRouterApiKey.length > 256) {
    return { error: 'OpenRouter API key is too long.' }
  }
  if (sportsPandaScoreToken.length > 512) {
    return { error: 'PandaScore token is too long.' }
  }
  if (sportsTheSportsDbApiKey.length > 512) {
    return { error: 'TheSportsDB API key is too long.' }
  }

  let validatedMarketContextData: ReturnType<typeof validateMarketContextSettingsInput>['data'] = null
  if (hasMarketContextPayload) {
    const validatedMarketContext = validateMarketContextSettingsInput({
      enabled: typeof marketContextEnabledRaw === 'string' ? marketContextEnabledRaw : undefined,
      prompt: typeof marketContextPromptRaw === 'string' ? marketContextPromptRaw : '',
    })
    if (!validatedMarketContext.data) {
      return { error: validatedMarketContext.error ?? 'Invalid market context settings.' }
    }
    validatedMarketContextData = validatedMarketContext.data
  }

  const validatedGlobalAnnouncement = validateGlobalAnnouncementInput({
    message: globalAnnouncementMessage,
    linkUrl: globalAnnouncementLinkUrl,
    disabledOnJson: globalAnnouncementDisabledOnJson,
    disableFaucetBanner: globalAnnouncementDisableFaucetBanner,
  })
  if (!validatedGlobalAnnouncement.data) {
    return { error: validatedGlobalAnnouncement.error ?? 'Invalid global announcement input.' }
  }

  const validatedBlockedCountries = validateBlockedCountriesInput(blockedCountriesInput)
  if (!validatedBlockedCountries.data) {
    return { error: validatedBlockedCountries.error ?? 'Invalid blocked countries input.' }
  }

  let validatedHomeFeaturedData: ReturnType<typeof validateHomeFeaturedSettingsInput>['data'] | null = null
  if (hasHomeFeaturedSettingsPayload) {
    const validatedHomeFeatured = validateHomeFeaturedSettingsInput({
      enabled: typeof homeFeaturedEnabledRaw === 'string' ? homeFeaturedEnabledRaw : '',
      useAi: typeof homeFeaturedUseAiRaw === 'string' ? homeFeaturedUseAiRaw : '',
      maxCards: typeof homeFeaturedMaxCardsRaw === 'string' ? homeFeaturedMaxCardsRaw : '',
      defaultContextMode: typeof homeFeaturedDefaultContextModeRaw === 'string' ? homeFeaturedDefaultContextModeRaw : '',
      newsSources: typeof homeFeaturedNewsSourcesRaw === 'string' ? homeFeaturedNewsSourcesRaw : '',
      commentBlacklist: typeof homeFeaturedCommentBlacklistRaw === 'string' ? homeFeaturedCommentBlacklistRaw : '',
      minVolume24h: typeof homeFeaturedMinVolume24hRaw === 'string' ? homeFeaturedMinVolume24hRaw : '',
      includeSportsToday: typeof homeFeaturedIncludeSportsTodayRaw === 'string' ? homeFeaturedIncludeSportsTodayRaw : '',
      includeNewEvents: typeof homeFeaturedIncludeNewEventsRaw === 'string' ? homeFeaturedIncludeNewEventsRaw : '',
      sideCardTitle: typeof homeFeaturedSideCardTitleRaw === 'string' ? homeFeaturedSideCardTitleRaw : '',
      sideCardText: typeof homeFeaturedSideCardTextRaw === 'string' ? homeFeaturedSideCardTextRaw : '',
      sideCardCtaLabel: typeof homeFeaturedSideCardCtaLabelRaw === 'string' ? homeFeaturedSideCardCtaLabelRaw : '',
      sideCardCtaHref: typeof homeFeaturedSideCardCtaHrefRaw === 'string' ? homeFeaturedSideCardCtaHrefRaw : '',
      sideCardIcon: typeof homeFeaturedSideCardIconRaw === 'string' ? homeFeaturedSideCardIconRaw : '',
      sideCardUseAi: typeof homeFeaturedSideCardUseAiRaw === 'string' ? homeFeaturedSideCardUseAiRaw : '',
      sideCardUseImage: typeof homeFeaturedSideCardUseImageRaw === 'string' ? homeFeaturedSideCardUseImageRaw : '',
      sideCardImagePath: typeof homeFeaturedSideCardImagePathRaw === 'string' ? homeFeaturedSideCardImagePathRaw : '',
    })
    if (!validatedHomeFeatured.data) {
      return { error: validatedHomeFeatured.error ?? 'Invalid featured markets settings.' }
    }
    validatedHomeFeaturedData = validatedHomeFeatured.data
  }

  let parsedHomeFeaturedEventsData: ReturnType<typeof parseHomeFeaturedEventsPayload>['data'] | null = null
  if (hasHomeFeaturedEventsPayload) {
    const parsedHomeFeaturedEvents = parseHomeFeaturedEventsPayload(homeFeaturedEventsJson)
    if (!parsedHomeFeaturedEvents.data) {
      return { error: parsedHomeFeaturedEvents.error ?? 'Invalid featured markets payload.' }
    }
    parsedHomeFeaturedEventsData = parsedHomeFeaturedEvents.data
  }

  const normalizedTermsOfServicePdfPath = normalizeTermsOfServicePdfPath(tosPdfPath)
  if (normalizedTermsOfServicePdfPath.error) {
    return { error: normalizedTermsOfServicePdfPath.error }
  }
  tosPdfPath = normalizedTermsOfServicePdfPath.value

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

  if (tosPdfFileRaw instanceof File && tosPdfFileRaw.size > 0) {
    const processed = await processTermsOfServicePdfFile(tosPdfFileRaw)
    if (!processed.path) {
      return { error: processed.error ?? DEFAULT_ERROR_MESSAGE }
    }

    tosPdfPath = processed.path
  }

  if (validatedHomeFeaturedData?.sideCard.useImage) {
    if (homeFeaturedSideCardImageFileRaw instanceof File && homeFeaturedSideCardImageFileRaw.size > 0) {
      const processed = await processSideCardImageFile(homeFeaturedSideCardImageFileRaw)
      if (!processed.path) {
        return { error: processed.error ?? DEFAULT_ERROR_MESSAGE }
      }
      validatedHomeFeaturedData.sideCard.imagePath = processed.path
    }

    if (!validatedHomeFeaturedData.sideCard.imagePath) {
      return { error: 'Choose a side card image before saving.' }
    }
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
    twitterLink,
    facebookLink,
    instagramLink,
    tiktokLink,
    linkedinLink,
    youtubeLink,
    supportUrl,
    customJavascriptCodesJson,
    feeRecipientWallet: '',
    lifiIntegrator,
    lifiApiKey,
  })

  if (!validated.data) {
    return { error: validated.error ?? 'Invalid input.' }
  }

  let encryptedLiFiApiKey = ''
  let encryptedOpenRouterApiKey = ''
  let encryptedSportsPandaScoreToken = ''
  let encryptedSportsTheSportsDbApiKey = ''
  try {
    const { data: allSettings, error: settingsError } = await SettingsRepository.getSettings()
    if (settingsError) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    const existingEncryptedLiFiApiKey = allSettings?.general?.lifi_api_key?.value ?? ''
    const existingEncryptedOpenRouterApiKey = allSettings?.ai?.openrouter_api_key?.value ?? ''
    const existingEncryptedSportsPandaScoreToken = allSettings?.ai?.sports_pandascore_token?.value ?? ''
    const existingEncryptedSportsTheSportsDbApiKey = allSettings?.ai?.sports_thesportsdb_api_key?.value ?? ''
    encryptedLiFiApiKey = validated.data.lifiApiKeyValue
      ? encryptSecret(validated.data.lifiApiKeyValue)
      : existingEncryptedLiFiApiKey
    encryptedOpenRouterApiKey = openRouterApiKey
      ? encryptSecret(openRouterApiKey)
      : existingEncryptedOpenRouterApiKey
    encryptedSportsPandaScoreToken = sportsPandaScoreToken
      ? encryptSecret(sportsPandaScoreToken)
      : existingEncryptedSportsPandaScoreToken
    encryptedSportsTheSportsDbApiKey = sportsTheSportsDbApiKey
      ? encryptSecret(sportsTheSportsDbApiKey)
      : existingEncryptedSportsTheSportsDbApiKey
  }
  catch (error) {
    console.error('Failed to encrypt API keys', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const settingsToUpdate = [
    { group: 'general', key: 'site_name', value: validated.data.siteNameValue },
    { group: 'general', key: 'site_description', value: validated.data.siteDescriptionValue },
    { group: 'general', key: 'site_logo_mode', value: validated.data.logoModeValue },
    { group: 'general', key: 'site_logo_svg', value: validated.data.logoSvgValue },
    { group: 'general', key: 'site_logo_image_path', value: validated.data.logoImagePathValue },
    { group: 'general', key: 'pwa_icon_192_path', value: validated.data.pwaIcon192PathValue },
    { group: 'general', key: 'pwa_icon_512_path', value: validated.data.pwaIcon512PathValue },
    { group: 'general', key: 'site_google_analytics', value: validated.data.googleAnalyticsIdValue },
    { group: 'general', key: 'site_discord_link', value: validated.data.discordLinkValue },
    { group: 'general', key: 'site_twitter_link', value: validated.data.twitterLinkValue },
    { group: 'general', key: 'site_facebook_link', value: validated.data.facebookLinkValue },
    { group: 'general', key: 'site_instagram_link', value: validated.data.instagramLinkValue },
    { group: 'general', key: 'site_tiktok_link', value: validated.data.tiktokLinkValue },
    { group: 'general', key: 'site_linkedin_link', value: validated.data.linkedinLinkValue },
    { group: 'general', key: 'site_youtube_link', value: validated.data.youtubeLinkValue },
    { group: 'general', key: 'site_support_url', value: validated.data.supportUrlValue },
    { group: 'general', key: BLOCKED_COUNTRIES_SETTINGS_KEY, value: validatedBlockedCountries.data.blockedCountriesValue },
    { group: 'general', key: GLOBAL_ANNOUNCEMENT_MESSAGE_KEY, value: validatedGlobalAnnouncement.data.messageValue },
    { group: 'general', key: GLOBAL_ANNOUNCEMENT_LINK_URL_KEY, value: validatedGlobalAnnouncement.data.linkUrlValue },
    { group: 'general', key: GLOBAL_ANNOUNCEMENT_DISABLED_ON_KEY, value: validatedGlobalAnnouncement.data.disabledOnValue },
    { group: 'general', key: GLOBAL_ANNOUNCEMENT_DISABLE_FAUCET_BANNER_KEY, value: validatedGlobalAnnouncement.data.disableFaucetBannerValue },
    { group: 'general', key: 'site_custom_javascript_codes', value: validated.data.customJavascriptCodesValue },
    { group: 'general', key: TERMS_OF_SERVICE_PDF_PATH_KEY, value: tosPdfPath },
    { group: 'general', key: 'lifi_integrator', value: validated.data.lifiIntegratorValue },
    { group: 'general', key: 'lifi_api_key', value: encryptedLiFiApiKey },
    {
      group: ARBITRAGE_SETTINGS_GROUP,
      key: ARBITRAGE_ENABLED_SETTINGS_KEY,
      value: arbitrageEnabledRaw === 'true' ? 'true' : 'false',
    },
    {
      group: ARBITRAGE_SETTINGS_GROUP,
      key: ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY,
      value: arbitrageMultiWalletEnabledRaw === 'true' ? 'true' : 'false',
    },
    { group: 'ai', key: 'openrouter_model', value: openRouterModel },
    { group: 'ai', key: 'openrouter_api_key', value: encryptedOpenRouterApiKey },
    ...(validatedMarketContextData
      ? [
          { group: 'ai', key: 'market_context_prompt', value: validatedMarketContextData.prompt },
          { group: 'ai', key: 'market_context_enabled', value: validatedMarketContextData.enabled ? 'true' : 'false' },
        ]
      : []),
    { group: 'ai', key: 'sports_pandascore_token', value: encryptedSportsPandaScoreToken },
    { group: 'ai', key: 'sports_thesportsdb_api_key', value: encryptedSportsTheSportsDbApiKey },
    ...(validatedHomeFeaturedData ? buildHomeFeaturedSettingsUpdateRows(validatedHomeFeaturedData) : []),
  ]

  if (parsedHomeFeaturedEventsData) {
    const { HomeFeaturedEventsRepository } = await import('@/lib/db/queries/home-featured-events')
    const { error } = await HomeFeaturedEventsRepository.replaceFeaturedEventsWithSettings(
      parsedHomeFeaturedEventsData,
      settingsToUpdate,
    )
    if (error) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }
  }
  else {
    const { error } = await SettingsRepository.updateSettings(settingsToUpdate)

    if (error) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }
  }

  if (validatedHomeFeaturedData?.useAi) {
    await runOptionalGeneralSettingsTask('regenerate featured markets', async () => {
      const locale = await resolveCurrentLocale()
      const { regenerateHomeFeaturedEvents } = await import('@/lib/home-featured-ai')
      const regenerateResult = await regenerateHomeFeaturedEvents(locale, {
        settings: validatedHomeFeaturedData,
      })
      if (regenerateResult.error) {
        console.warn('Featured markets were saved, but automatic regeneration failed:', regenerateResult.error)
      }
    })
  }

  await runOptionalGeneralSettingsTask('revalidate general settings paths', revalidateGeneralSettingsPaths)

  if (validatedMarketContextData) {
    await runOptionalGeneralSettingsTask('revalidate market context paths', revalidateMarketContextPaths)
  }

  await runOptionalGeneralSettingsTask('report operator domain snapshot', reportOperatorDomainSnapshot)

  try {
    await syncGeoblockSettings()
  }
  catch (syncError) {
    console.error('Failed to sync geoblock settings', syncError)
    return { error: 'Settings saved, but geoblock sync failed. Please try again.' }
  }

  return { error: null }
}

export async function updateGeneralSettingsAction(
  _prevState: GeneralSettingsActionState,
  formData: FormData,
): Promise<GeneralSettingsActionState> {
  try {
    return await updateGeneralSettingsActionImpl(_prevState, formData)
  }
  catch (error) {
    console.error('Failed to update general settings', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function removeTermsOfServicePdfAction(): Promise<GeneralSettingsActionState> {
  const user = await UserRepository.getCurrentUser({ minimal: true })
  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const { error } = await SettingsRepository.updateSettings([
    { group: 'general', key: TERMS_OF_SERVICE_PDF_PATH_KEY, value: '' },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  await runOptionalGeneralSettingsTask('revalidate general settings paths', revalidateGeneralSettingsPaths)

  return { error: null }
}
