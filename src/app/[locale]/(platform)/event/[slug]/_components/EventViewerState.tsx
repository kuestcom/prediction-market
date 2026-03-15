'use client'

import type { User } from '@/types'
import { useEffect, useRef } from 'react'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

interface EventViewerStateProps {
  shouldHydrateSession: boolean
}

export default function EventViewerState({ shouldHydrateSession }: EventViewerStateProps) {
  const user = useUser()
  const userId = user?.id ?? null
  const lastHydratedUserIdRef = useRef<string | null>(shouldHydrateSession ? '__initial__' : null)

  useEffect(() => {
    if (!shouldHydrateSession && userId === null) {
      return
    }

    if (shouldHydrateSession && lastHydratedUserIdRef.current === null) {
      lastHydratedUserIdRef.current = '__initial__'
    }

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
  }, [shouldHydrateSession, userId])

  return null
}
