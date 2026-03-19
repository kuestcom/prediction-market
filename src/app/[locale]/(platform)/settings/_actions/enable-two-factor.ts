'use server'

import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { extractTwoFactorErrorMessage, isPasswordAlreadySetError } from './two-factor-errors'

export async function enableTwoFactorAction() {
  try {
    const user = await UserRepository.getCurrentUser()
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const h = await headers()

    await prepareAccount(user.address, h)

    return await auth.api.enableTwoFactor({
      body: {
        password: user.address,
      },
      headers: h,
    })
  }
  catch (error) {
    console.error('Failed to enable two-factor:', error)
    return { error: extractTwoFactorErrorMessage(error) ?? DEFAULT_ERROR_MESSAGE }
  }
}

async function prepareAccount(newPassword: string, h: ReadonlyHeaders) {
  try {
    await auth.api.setPassword({
      body: { newPassword },
      headers: h,
    })
  }
  catch (error: any) {
    if (!isPasswordAlreadySetError(error)) {
      throw error
    }
  }
}
