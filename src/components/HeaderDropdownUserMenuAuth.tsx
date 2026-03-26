'use client'

import { useDisconnect } from '@reown/appkit-controllers/react'
import { BadgePercentIcon, ChevronDownIcon, DownloadIcon, SettingsIcon, ShieldIcon, TrophyIcon, UnplugIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import LocaleSwitcherMenuItem from '@/components/LocaleSwitcherMenuItem'
import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import ThemeSelector from '@/components/ThemeSelector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import UserInfoSection from '@/components/UserInfoSection'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { usePathname } from '@/i18n/navigation'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { signOutAndRedirect } from '@/lib/logout'
import { useUser } from '@/stores/useUser'

export default function HeaderDropdownUserMenuAuth() {
  const t = useExtracted()
  const { isReady } = useAppKit()
  const { disconnect } = useDisconnect()
  const user = useUser()
  const { canShowInstallUi, isIos, isPrompting, requestInstall } = usePwaInstall()
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isMobile = useIsMobile()
  const enableHoverOpen = !isMobile
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avatarUrl = user?.image?.trim() ?? ''
  const avatarSeed = user?.proxy_wallet_address || user?.address || user?.username || 'user'
  const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
  const placeholderStyle = showPlaceholder
    ? getAvatarPlaceholderStyle(avatarSeed)
    : undefined

  useEffect(() => () => clearCloseTimeout(), [])

  function relatedTargetIsWithin(ref: React.RefObject<HTMLElement | null>, relatedTarget: EventTarget | null) {
    const current = ref.current
    if (!current) {
      return false
    }

    const nodeConstructor = current.ownerDocument?.defaultView?.Node ?? Node
    if (!(relatedTarget instanceof nodeConstructor)) {
      return false
    }

    return current.contains(relatedTarget)
  }

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function handleWrapperPointerEnter() {
    if (!enableHoverOpen) {
      return
    }

    clearCloseTimeout()
    setMenuOpen(true)
  }

  function handleWrapperPointerLeave(event: React.PointerEvent) {
    if (!enableHoverOpen) {
      return
    }

    if (relatedTargetIsWithin(wrapperRef, event.relatedTarget)) {
      return
    }

    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setMenuOpen(false)
    }, 120)
  }

  function handleMenuClose() {
    setMenuOpen(false)
  }

  async function handleInstallAction() {
    handleMenuClose()

    if (isIos) {
      toast.info(t('Install app'), {
        description: (
          <PwaInstallIosInstructions className="max-w-sm pt-1" />
        ),
      })
      return
    }

    try {
      await requestInstall()
    }
    catch {
      toast.error(t('An unexpected error occurred. Please try again.'))
    }
  }

  async function handleLogout() {
    handleMenuClose()

    if (!isReady) {
      try {
        await signOutAndRedirect({
          currentPathname: window.location.pathname,
        })
      }
      catch {
        toast.error(t('Could not log out. Please try again.'))
      }
      return
    }

    try {
      await disconnect()
      return
    }
    catch {
      //
    }

    try {
      await signOutAndRedirect({
        currentPathname: window.location.pathname,
      })
    }
    catch {
      toast.error(t('Could not log out. Please try again.'))
    }
  }

  if (!user) {
    return <></>
  }

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={enableHoverOpen ? handleWrapperPointerEnter : undefined}
      onPointerLeave={enableHoverOpen ? handleWrapperPointerLeave : undefined}
      className="font-medium"
    >
      <DropdownMenu
        key={isAdmin ? 'admin' : 'platform'}
        open={menuOpen}
        onOpenChange={(nextOpen) => {
          clearCloseTimeout()
          setMenuOpen(nextOpen)
        }}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="header"
            aria-label="User menu"
            className={`
              group flex cursor-pointer items-center gap-2 px-2 transition-colors
              hover:bg-accent/70 hover:text-accent-foreground
              data-[state=open]:bg-accent/70 data-[state=open]:text-accent-foreground
            `}
            data-testid="header-menu-button"
          >
            {showPlaceholder
              ? (
                  <div
                    aria-hidden="true"
                    className="aspect-square size-8 shrink-0 rounded-full"
                    style={placeholderStyle}
                  />
                )
              : (
                  <Image
                    src={avatarUrl}
                    alt="User avatar"
                    width={32}
                    height={32}
                    className="aspect-square shrink-0 rounded-full object-cover"
                  />
                )}
            <ChevronDownIcon className={`
              size-4 transition-transform duration-150
              group-hover:rotate-180
              group-data-[state=open]:rotate-180
            `}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="z-70 w-64"
          align="end"
          sideOffset={0}
          collisionPadding={16}
          portalled={isMobile}
          onInteractOutside={() => setMenuOpen(false)}
          onEscapeKeyDown={() => setMenuOpen(false)}
        >
          <DropdownMenuItem asChild>
            <UserInfoSection />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
            <IntentPrefetchLink href="/settings" className="flex w-full items-center gap-1.5">
              <SettingsIcon className="size-4 text-orange-500" />
              {t('Settings')}
            </IntentPrefetchLink>
          </DropdownMenuItem>

          {canShowInstallUi && (
            <DropdownMenuItem
              className="py-2 text-sm font-semibold"
              onSelect={() => {
                void handleInstallAction()
              }}
              disabled={isPrompting}
            >
              <div className="flex w-full items-center gap-1.5">
                <DownloadIcon className="size-4 text-sky-500" />
                {t('Install app')}
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
            <IntentPrefetchLink href="/leaderboard" className="flex w-full items-center gap-1.5">
              <TrophyIcon className="size-4 text-amber-500" />
              {t('Leaderboard')}
            </IntentPrefetchLink>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
            <IntentPrefetchLink href="/settings/affiliate" className="flex w-full items-center gap-1.5">
              <BadgePercentIcon className="size-4 text-emerald-600" />
              {t('Affiliate')}
            </IntentPrefetchLink>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
            <IntentPrefetchLink
              href="/docs/api-reference"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-1.5"
            >
              <UnplugIcon className="size-4 text-pink-500" />
              {t('APIs')}
            </IntentPrefetchLink>
          </DropdownMenuItem>

          {user?.is_admin && (
            <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
              <IntentPrefetchLink href="/admin" className="flex w-full items-center gap-1.5">
                <ShieldIcon className="size-4 text-current" />
                {t('Admin')}
              </IntentPrefetchLink>
            </DropdownMenuItem>
          )}

          <div className="flex items-center justify-between gap-2 px-2 py-1 text-sm font-semibold">
            <span>{t('Dark Mode')}</span>
            <ThemeSelector />
          </div>

          {isMobile && (
            <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
              <div className="flex justify-center" onClickCapture={handleMenuClose}>
                <HeaderPortfolio />
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-muted-foreground">
            <IntentPrefetchLink href="/docs/users" data-testid="header-docs-link">{t('Documentation')}</IntentPrefetchLink>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-muted-foreground">
            <IntentPrefetchLink href="/terms-of-use" data-testid="header-terms-link">{t('Terms of Use')}</IntentPrefetchLink>
          </DropdownMenuItem>

          <LocaleSwitcherMenuItem />

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold">
            <button type="button" className="w-full text-destructive" onClick={() => void handleLogout()}>
              {t('Logout')}
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
