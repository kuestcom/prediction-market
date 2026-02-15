'use client'

import { getL2AuthContextId } from '@/lib/l2-auth-context-client'

/**
 * Wrapper function to add L2 auth context header to server actions
 *
 * Note: This approach won't work with Next.js server actions because we can't
 * modify headers in server actions directly. The header needs to be set during
 * the initial request.
 *
 * For proper implementation, we need to:
 * 1. Use a fetch-based API route instead of server actions, OR
 * 2. Set the header in middleware, OR
 * 3. Pass the contextId as a parameter to server actions
 */
export function withL2AuthContext<T extends any[], R>(
  action: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    // For server actions, we can't modify headers directly
    // This would need to be implemented differently
    console.warn('withL2AuthContext: Cannot modify headers for server actions')
    return action(...args)
  }
}

/**
 * Alternative approach: Pass L2 context as parameter to server actions
 */
export function getL2AuthContextForAction(): { l2AuthContextId: string | null } {
  return {
    l2AuthContextId: getL2AuthContextId(),
  }
}
