'use server'

import { revalidatePath } from 'next/cache'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { validateThemeSettingsInput } from '@/lib/theme-settings'

export interface ThemeSettingsActionState {
  error: string | null
}

export async function updateThemeSettingsAction(
  _prevState: ThemeSettingsActionState,
  formData: FormData,
): Promise<ThemeSettingsActionState> {
  const user = await UserRepository.getCurrentUser()
  if (!user || !user.is_admin) {
    return { error: 'Unauthenticated.' }
  }

  const presetValue = formData.get('preset')
  const preset = typeof presetValue === 'string'
    ? presetValue
    : ''
  const radiusValue = formData.get('radius')
  const radius = typeof radiusValue === 'string'
    ? radiusValue
    : ''
  const lightJsonValue = formData.get('light_json')
  const lightJson = typeof lightJsonValue === 'string'
    ? lightJsonValue
    : '{}'
  const darkJsonValue = formData.get('dark_json')
  const darkJson = typeof darkJsonValue === 'string'
    ? darkJsonValue
    : '{}'

  const validatedTheme = validateThemeSettingsInput({
    preset,
    radius,
    lightJson,
    darkJson,
  })

  if (!validatedTheme.data) {
    return { error: validatedTheme.error ?? 'Invalid input.' }
  }

  const { error } = await SettingsRepository.updateSettings([
    { group: 'theme', key: 'preset', value: validatedTheme.data.presetId },
    { group: 'theme', key: 'radius', value: validatedTheme.data.radiusValue },
    { group: 'theme', key: 'light_json', value: validatedTheme.data.lightJson },
    { group: 'theme', key: 'dark_json', value: validatedTheme.data.darkJson },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/[locale]/admin/theme', 'page')
  revalidatePath('/[locale]', 'layout')

  return { error: null }
}
