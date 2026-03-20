import type { User } from '@/types'
import { create } from 'zustand'

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
  if (!previous) {
    return {
      ...nextUser,
      image: nextUser.image ?? '',
    }
  }

  const mergedUser: User = {
    ...previous,
    ...nextUser,
    image: nextUser.image ?? previous.image ?? '',
    settings: {
      ...(previous.settings ?? {}),
      ...(nextUser.settings ?? {}),
    },
  }

  return areStoreValuesEqual(previous, mergedUser) ? previous : mergedUser
}

export const useUser = create<User | null>()(() => null)
