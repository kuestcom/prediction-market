'use server'

import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { normalizeAddress } from '@/lib/wallet'

export interface DeleteAccountActionState {
  error?: string
}

const DeleteRelayerUserDataSchema = z.object({
  address: z.string().refine(value => Boolean(normalizeAddress(value)), 'Invalid wallet address.'),
  signature: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^\d+$/),
})

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

export async function deleteRelayerUserDataAction(input: z.input<typeof DeleteRelayerUserDataSchema>): Promise<DeleteAccountActionState> {
  try {
    const parsed = DeleteRelayerUserDataSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR_MESSAGE }
    }

    const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
    if (!user) {
      return { error: 'Unauthenticated.' }
    }

    const normalizedInputAddress = normalizeAddress(parsed.data.address)?.toLowerCase()
    const normalizedUserAddress = normalizeAddress(typeof user.address === 'string' ? user.address : null)?.toLowerCase()
    if (!normalizedInputAddress || normalizedInputAddress !== normalizedUserAddress) {
      return { error: 'Connect the wallet linked to this account before deleting it.' }
    }

    const { relayerUrl } = resolvePublicRuntimeEnv(process.env)
    const response = await fetch(`${relayerUrl}/auth/user-data`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        KUEST_ADDRESS: parsed.data.address,
        KUEST_SIGNATURE: parsed.data.signature,
        KUEST_TIMESTAMP: parsed.data.timestamp,
        KUEST_NONCE: parsed.data.nonce,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    return {}
  }
  catch (error) {
    console.error('Failed to delete relayer user data:', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
