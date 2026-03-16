'use client'

import type { User } from '@/types'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

const { useSession } = authClient

export default function PlatformViewerState() {
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (isPending) {
      return
    }

    if (!session?.user) {
      useUser.setState(null)
      return
    }

    const sessionSettings = (session.user as Partial<User>).settings
    useUser.setState((previous) => {
      if (!previous) {
        return { ...session.user, image: session.user.image ?? '' }
      }

      return {
        ...previous,
        ...session.user,
        image: session.user.image ?? previous.image ?? '',
        settings: {
          ...(previous.settings ?? {}),
          ...(sessionSettings ?? {}),
        },
      }
    })
  }, [isPending, session?.user])

  return null
}
