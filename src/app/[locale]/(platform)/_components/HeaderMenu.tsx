'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import HeaderDropdownUserMenuGuest from '@/app/[locale]/(platform)/_components/HeaderDropdownUserMenuGuest'
import HeaderNotifications from '@/app/[locale]/(platform)/_components/HeaderNotifications'
import { useOptionalTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'

const { useSession } = authClient

const HeaderDepositButton = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HeaderDepositButton'),
  { ssr: false },
)

export default function HeaderMenu() {
  return <HeaderMenuClient />
}

function HeaderMenuClient() {
  const t = useExtracted()
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { data: session, isPending: isSessionPending } = useSession()
  const isMobile = useIsMobile()
  const tradingOnboarding = useOptionalTradingOnboarding()
  const user = useUser()

  const isAuthenticated = Boolean(session?.user) || Boolean(user) || isConnected
  const shouldShowGuestActions = !isAuthenticated && !isSessionPending
  const startDepositFlow = tradingOnboarding?.startDepositFlow

  return (
    <>
      {isAuthenticated && (
        <>
          {!isMobile && <HeaderPortfolio />}
          {!isMobile && (
            startDepositFlow
              ? (
                  <Button size="headerCompact" onClick={startDepositFlow}>
                    {t('Deposit')}
                  </Button>
                )
              : (
                  <HeaderDepositButton />
                )
          )}
          <HeaderNotifications />
          <div className="-ml-1 hidden h-5 w-px bg-border md:block" aria-hidden="true" />
          <HeaderDropdownUserMenuAuth />
        </>
      )}

      {shouldShowGuestActions && (
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
          {!isMobile && <HeaderDropdownUserMenuGuest />}
        </>
      )}
    </>
  )
}
