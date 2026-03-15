'use client'

import type { User } from '@/types'
import { useEffect, useRef } from 'react'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

export default function EventViewerState() {
  const user = useUser()
  const userId = user?.id ?? null
  const lastHydratedUserIdRef = useRef<string | null>('__initial__')

  useEffect(() => {
    if (lastHydratedUserIdRef.current === userId) {
      return
    }

    let isActive = true

    void authClient.getSession({
      query: {
        disableCookieCache: true,
      },
    }).then((session) => {
      if (!isActive) {
        return
      }

      const sessionUser = session?.data?.user as User | undefined
      if (!sessionUser) {
        lastHydratedUserIdRef.current = null
        useUser.setState(null)
        return
      }

      lastHydratedUserIdRef.current = sessionUser.id
      useUser.setState((previous) => {
        if (!previous) {
          return {
            ...sessionUser,
            image: sessionUser.image ?? '',
          }
        }

        return {
          ...previous,
          ...sessionUser,
          image: sessionUser.image ?? previous.image ?? '',
          settings: {
            ...(previous.settings ?? {}),
            ...(sessionUser.settings ?? {}),
          },
        }
      })
    }).catch(() => {})

    return () => {
      isActive = false
    }
  }, [userId])

  return null
}
