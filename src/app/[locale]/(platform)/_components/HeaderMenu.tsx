'use client'

import type { User } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import { useEffect } from 'react'
import HeaderDropdownUserMenuGuest from '@/app/[locale]/(platform)/_components/HeaderDropdownUserMenuGuest'
import HeaderNotifications from '@/app/[locale]/(platform)/_components/HeaderNotifications'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppKit } from '@/hooks/useAppKit'
import { useClientMounted } from '@/hooks/useClientMounted'
import { useIsMobile } from '@/hooks/useIsMobile'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

const { useSession } = authClient

export default function HeaderMenu() {
  const t = useExtracted()
  const isMounted = useClientMounted()
  const { open, isReady } = useAppKit()
  const { isConnected, status } = useAppKitAccount()
  const { data: session, isPending } = useSession()
  const isMobile = useIsMobile()
  const { startDepositFlow } = useTradingOnboarding()
  const user = useUser()

  useEffect(() => {
    if (session?.user) {
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
    }
    else {
      useUser.setState(null)
    }
  }, [session?.user])

  const isAuthenticated = Boolean(user) || isConnected
  const shouldWaitForAppKit = Boolean(session?.user) && (status === 'connecting' || !isReady)
  const showSkeleton = !user && (isPending || !isMounted || shouldWaitForAppKit)

  if (showSkeleton) {
    return (
      <div className="flex gap-1 sm:gap-2 lg:gap-4">
        <Skeleton className="hidden h-9 w-18 lg:block" />
        <Skeleton className="hidden h-9 w-18 lg:block" />
        <Skeleton className="hidden h-9 w-20 lg:block" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-18" />
      </div>
    )
  }

  return (
    <>
      {isAuthenticated && (
        <>
          {!isMobile && <HeaderPortfolio />}
          {!isMobile && (
            <Button size="headerCompact" onClick={startDepositFlow}>
              {t('Deposit')}
            </Button>
          )}
          <HeaderNotifications />
          <div className="h-6 w-px bg-border" aria-hidden="true" />
          <HeaderDropdownUserMenuAuth />
        </>
      )}

      {!isAuthenticated && (
        <>
          <Button
            size="headerCompact"
            variant="link"
            className="no-underline hover:bg-accent/70 hover:no-underline"
            data-testid="header-login-button"
            onClick={() => open()}
          >
            {t('Log In')}
          </Button>
          <Button
            size="headerCompact"
            data-testid="header-signup-button"
            onClick={() => open()}
          >
            {t('Sign Up')}
          </Button>
          <HeaderDropdownUserMenuGuest />
        </>
      )}
    </>
  )
}
