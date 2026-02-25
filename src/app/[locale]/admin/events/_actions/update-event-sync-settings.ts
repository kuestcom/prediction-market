'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { AUTO_DEPLOY_NEW_EVENTS_KEY, EVENTS_SETTINGS_GROUP } from '@/lib/event-sync-settings'

export interface UpdateEventSyncSettingsResult {
  success: boolean
  error?: string
}

export async function updateEventSyncSettingsAction(
  autoDeployNewEvents: boolean,
): Promise<UpdateEventSyncSettingsResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const { error } = await SettingsRepository.updateSettings([
      {
        group: EVENTS_SETTINGS_GROUP,
        key: AUTO_DEPLOY_NEW_EVENTS_KEY,
        value: autoDeployNewEvents ? 'true' : 'false',
      },
    ])

    if (error) {
      return {
        success: false,
        error: 'Failed to update sync settings.',
      }
    }

    revalidatePath('/[locale]/admin/events', 'page')
    updateTag(cacheTags.settings)

    return { success: true }
  }
  catch (error) {
    console.error('Server action error:', error)
    return {
      success: false,
      error: 'Internal server error. Please try again.',
    }
  }
}
