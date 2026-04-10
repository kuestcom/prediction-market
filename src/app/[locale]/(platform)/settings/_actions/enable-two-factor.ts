'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { extractTwoFactorErrorMessage } from './two-factor-errors'

export async function enableTwoFactorAction() {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser) {
      return { error: 'Unauthenticated.' }
    }

    const h = await headers()

    return await auth.api.enableTwoFactor({
      body: {},
      headers: h,
    })
  }
  catch (error) {
    console.error('Failed to enable two-factor:', error)
    return { error: extractTwoFactorErrorMessage(error) ?? DEFAULT_ERROR_MESSAGE }
  }
}
