'use server'

import { revalidatePath } from 'next/cache'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'

export async function updateNotificationSettingsAction(formData: FormData) {
  try {
    const preferences = {
      email_resolutions: formData.get('email_resolutions') === 'on',
      inapp_order_fills: formData.get('inapp_order_fills') === 'on',
      inapp_hide_small_fills: formData.get('inapp_hide_small_fills') === 'on',
      inapp_resolutions: formData.get('inapp_resolutions') === 'on',
    }

    const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const { error } = await UserRepository.updateUserNotificationSettings(user, preferences)

    if (error) {
      return { error }
    }

    revalidatePath('/settings')
  }
  catch {
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
