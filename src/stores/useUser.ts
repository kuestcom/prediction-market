import type { User } from '@/types'
import { create } from 'zustand'

const WALLET_FIELD_ALIASES = [
  ['deposit_wallet_address', 'proxy_wallet_address'],
  ['deposit_wallet_signature', 'proxy_wallet_signature'],
  ['deposit_wallet_signed_at', 'proxy_wallet_signed_at'],
  ['deposit_wallet_status', 'proxy_wallet_status'],
  ['deposit_wallet_tx_hash', 'proxy_wallet_tx_hash'],
] as const

function normalizeDepositWalletFields<T extends User | null>(user: T): T {
  if (!user) {
    return user
  }

  let normalized: Record<string, unknown> | null = null
  const source = user as unknown as Record<string, unknown>

  for (const [depositField, legacyField] of WALLET_FIELD_ALIASES) {
    if (source[depositField] === undefined && source[legacyField] !== undefined) {
      normalized ??= { ...source }
      normalized[depositField] = source[legacyField]
    }
  }

  return (normalized ?? source) as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function areStoreValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => areStoreValuesEqual(value, right[index]))
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    return leftKeys.every(key => areStoreValuesEqual(left[key], right[key]))
  }

  return false
}

export function mergeSessionUserState(previous: User | null, nextUser: User): User {
  const normalizedNextUser = normalizeDepositWalletFields(nextUser)

  if (!previous) {
    return {
      ...normalizedNextUser,
      image: normalizedNextUser.image ?? '',
    }
  }

  const mergedUser: User = {
    ...previous,
    ...normalizedNextUser,
    image: normalizedNextUser.image ?? previous.image ?? '',
    settings: {
      ...(previous.settings ?? {}),
      ...(normalizedNextUser.settings ?? {}),
    },
  }

  return areStoreValuesEqual(previous, mergedUser) ? previous : mergedUser
}

export const useUser = create<User | null>()(() => null)
