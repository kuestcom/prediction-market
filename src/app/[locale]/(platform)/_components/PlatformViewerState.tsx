'use client'

import type { User } from '@/types'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

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

    useUser.setState((previous) => {
      return mergeSessionUserState(previous, session.user as unknown as User)
    })
  }, [isPending, session?.user])

  return null
}
