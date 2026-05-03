'use server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'

export interface DeleteAccountActionState {
  error?: string
}

export async function deleteAccountAction(): Promise<DeleteAccountActionState> {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const { error } = await UserRepository.deleteUserAccountById(user.id)
    if (error) {
      return { error }
    }

    return {}
  }
  catch (error) {
    console.error('Failed to delete account:', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
