'use client'

import type { User } from '@/types'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

const AUTH_SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
]

function hasAuthSessionCookie() {
  if (typeof document === 'undefined') {
    return false
  }

  return document.cookie
    .split(';')
    .some((cookie) => {
      const cookieName = cookie.split('=')[0]?.trim()
      return cookieName != null && AUTH_SESSION_COOKIE_NAMES.includes(cookieName)
    })
}

export default function EventViewerState() {
  const user = useUser()
  const userId = user?.id
  const shouldHydrateSession = Boolean(userId) || hasAuthSessionCookie()

  useEffect(() => {
    if (!shouldHydrateSession) {
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
        useUser.setState(null)
        return
      }

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
  }, [shouldHydrateSession])

  return null
}
