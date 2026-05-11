'use client'

import type { User } from '@/types'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

const { useSession } = authClient

function useSyncViewerUserState() {
  const { data: session, isPending } = useSession()

  useEffect(function syncViewerUserStateFromSession() {
    if (isPending) {
      return
    }

    if (typeof session === 'undefined') {
      return
    }

    if (!session?.user) {
      useUser.setState(null)
      return
    }

    useUser.setState((previous) => {
      return mergeSessionUserState(previous, session.user as unknown as User)
    })
  }, [isPending, session, session?.user])
}

export default function PlatformViewerState() {
  useSyncViewerUserState()

  return null
}
