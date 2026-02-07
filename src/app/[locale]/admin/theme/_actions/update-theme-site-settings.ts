'use server'

import { Buffer } from 'node:buffer'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { supabaseAdmin } from '@/lib/supabase'
import { validateThemeSiteSettingsInput } from '@/lib/theme-settings'

const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export interface ThemeSiteSettingsActionState {
  error: string | null
}

async function uploadThemeLogoImage(file: File) {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    return { path: null, error: 'Logo image must be PNG, JPG, or WebP.' }
  }

  if (file.size > MAX_LOGO_FILE_SIZE) {
    return { path: null, error: 'Logo image must be 2MB or smaller.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const output = await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer()

  const filePath = `theme/site-logo-${Date.now()}.png`

  const { error } = await supabaseAdmin.storage
    .from('kuest-assets')
    .upload(filePath, output, {
      contentType: 'image/png',
      cacheControl: '31536000',
    })

  if (error) {
    return { path: null, error: DEFAULT_ERROR_MESSAGE }
  }

  return { path: filePath, error: null }
}

export async function updateThemeSiteSettingsAction(
  _prevState: ThemeSiteSettingsActionState,
  formData: FormData,
): Promise<ThemeSiteSettingsActionState> {
  const user = await UserRepository.getCurrentUser()
  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const siteNameRaw = formData.get('site_name')
  const siteDescriptionRaw = formData.get('site_description')
  const logoModeRaw = formData.get('logo_mode')
  const logoSvgRaw = formData.get('logo_svg')
  const logoImagePathRaw = formData.get('logo_image_path')
  const logoFileRaw = formData.get('logo_image')

  const siteName = typeof siteNameRaw === 'string' ? siteNameRaw : ''
  const siteDescription = typeof siteDescriptionRaw === 'string' ? siteDescriptionRaw : ''
  const logoMode = typeof logoModeRaw === 'string' ? logoModeRaw : ''
  const logoSvg = typeof logoSvgRaw === 'string' ? logoSvgRaw : ''
  let logoImagePath = typeof logoImagePathRaw === 'string' ? logoImagePathRaw : ''

  if (logoFileRaw instanceof File && logoFileRaw.size > 0) {
    const uploaded = await uploadThemeLogoImage(logoFileRaw)
    if (!uploaded.path) {
      return { error: uploaded.error ?? DEFAULT_ERROR_MESSAGE }
    }

    logoImagePath = uploaded.path
  }

  const validated = validateThemeSiteSettingsInput({
    siteName,
    siteDescription,
    logoMode,
    logoSvg,
    logoImagePath,
  })

  if (!validated.data) {
    return { error: validated.error ?? 'Invalid input.' }
  }

  const { error } = await SettingsRepository.updateSettings([
    { group: 'theme', key: 'site_name', value: validated.data.siteNameValue },
    { group: 'theme', key: 'site_description', value: validated.data.siteDescriptionValue },
    { group: 'theme', key: 'site_logo_mode', value: validated.data.logoModeValue },
    { group: 'theme', key: 'site_logo_svg', value: validated.data.logoSvgValue },
    { group: 'theme', key: 'site_logo_image_path', value: validated.data.logoImagePathValue },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/[locale]/admin/theme', 'page')
  revalidatePath('/[locale]', 'layout')

  return { error: null }
}
