'use client'

import { useDisconnect } from '@reown/appkit/react'
import { ChevronDownIcon, DownloadIcon, GiftIcon, SettingsIcon, ShieldIcon, TrophyIcon, UnplugIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import HeaderPortfolio from '@/components/HeaderPortfolio'
import LocaleSwitcherMenuItem from '@/components/LocaleSwitcherMenuItem'
import PwaInstallIosInstructions from '@/components/PwaInstallIosInstructions'
import ThemeSelector from '@/components/ThemeSelector'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import UserInfoSection from '@/components/UserInfoSection'
import { useAppKit } from '@/hooks/useAppKit'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Link, usePathname } from '@/i18n/navigation'
import { getAvatarPlaceholderStyle, shouldUseAvatarPlaceholder } from '@/lib/avatar'
import { signOutAndRedirect } from '@/lib/logout'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

function useHoverMenu(enableHoverOpen: boolean) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(function clearMenuCloseTimeoutOnUnmount() {
    const timeoutRef = closeTimeoutRef

    return function cleanupMenuCloseTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

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

  return {
    menuOpen,
    setMenuOpen,
    wrapperRef,
    clearCloseTimeout,
    handleWrapperPointerEnter,
    handleWrapperPointerLeave,
    handleMenuClose,
  }
}

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
  const {
    menuOpen,
    setMenuOpen,
    wrapperRef,
    clearCloseTimeout,
    handleWrapperPointerEnter,
    handleWrapperPointerLeave,
    handleMenuClose,
  } = useHoverMenu(enableHoverOpen)
  const avatarUrl = user?.image?.trim() ?? ''
  const avatarSeed = user?.deposit_wallet_address || user?.address || user?.username || 'user'
  const showPlaceholder = shouldUseAvatarPlaceholder(avatarUrl)
  const placeholderStyle = showPlaceholder ? getAvatarPlaceholderStyle(avatarSeed) : undefined

  async function handleInstallAction() {
    handleMenuClose()

    if (isIos) {
      toast.info(t('Install app'), {
        duration: 10_000,
        description: <PwaInstallIosInstructions className="max-w-sm pt-1" />,
      })
      return
    }

    try {
      await requestInstall()
    } catch {
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
      } catch {
        toast.error(t('Could not log out. Please try again.'))
      }
      return
    }

    try {
      await disconnect()
      return
    } catch {
      //
    }

    try {
      await signOutAndRedirect({
        currentPathname: window.location.pathname,
      })
    } catch {
      toast.error(t('Could not log out. Please try again.'))
    }
  }

  if (!user) {
    return null
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
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="User menu"
              className={cn(
                `group flex cursor-pointer items-center gap-2 px-2 transition-colors hover:bg-accent/70 hover:text-accent-foreground data-popup-open:bg-accent/70 data-popup-open:text-accent-foreground`,
              )}
              data-testid="header-menu-button"
            />
          }
        >
          {showPlaceholder ? (
            <div aria-hidden="true" className="aspect-square size-8 shrink-0 rounded-full" style={placeholderStyle} />
          ) : (
            <Image
              src={avatarUrl}
              alt="User avatar"
              width={32}
              height={32}
              className="aspect-square shrink-0 rounded-full object-cover"
            />
          )}
          <ChevronDownIcon
            className={cn(
              `size-4 transition-transform duration-150 group-hover:rotate-180 group-data-popup-open:rotate-180`,
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="z-70 w-64"
          align="end"
          sideOffset={0}
          collisionPadding={16}
          portalled={isMobile}
        >
          <DropdownMenuItem render={<UserInfoSection />} />

          <DropdownMenuSeparator />

          <DropdownMenuLinkItem
            render={<Link href="/settings" className="flex w-full items-center gap-1.5" />}
            className="py-2 text-sm font-semibold"
          >
            <SettingsIcon className="size-4 text-orange-500" />
            {t('Settings')}
          </DropdownMenuLinkItem>

          {canShowInstallUi && (
            <DropdownMenuItem
              className="py-2 text-sm font-semibold"
              onClick={() => {
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

          <DropdownMenuLinkItem
            render={<Link href="/leaderboard" className="flex w-full items-center gap-1.5" />}
            className="py-2 text-sm font-semibold"
          >
            <TrophyIcon className="size-4 text-amber-500" />
            {t('Leaderboard')}
          </DropdownMenuLinkItem>

          <DropdownMenuLinkItem
            render={<Link href="/settings/rewards" className="flex w-full items-center gap-1.5" />}
            className="py-2 text-sm font-semibold"
          >
            <GiftIcon className="size-4 text-violet-500" />
            {t('Rewards')}
          </DropdownMenuLinkItem>

          <DropdownMenuLinkItem
            render={
              <Link
                href="/docs/api-reference"
                target="_blank"
                prefetch={false}
                rel="noreferrer"
                className="flex w-full items-center gap-1.5"
              />
            }
            className="py-2 text-sm font-semibold"
          >
            <UnplugIcon className="size-4 text-pink-500" />
            {t('APIs')}
          </DropdownMenuLinkItem>

          {user?.is_admin && (
            <DropdownMenuLinkItem
              render={<Link href="/admin" className="flex w-full items-center gap-1.5" />}
              className="py-2 text-sm font-semibold"
            >
              <ShieldIcon className="size-4 text-current" />
              {t('Admin')}
            </DropdownMenuLinkItem>
          )}

          <div className="flex items-center justify-between gap-2 px-2 py-1 text-sm font-semibold">
            <span>{t('Dark Mode')}</span>
            <ThemeSelector />
          </div>

          {isMobile && (
            <DropdownMenuItem
              render={<div className="flex justify-center" onClickCapture={handleMenuClose} />}
              className="py-2 text-sm font-semibold"
            >
              <HeaderPortfolio />
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuLinkItem
            render={<Link href="/docs" target="_blank" prefetch={false} data-testid="header-docs-link" />}
            className="py-2 text-sm font-semibold text-muted-foreground"
          >
            {t('Documentation')}
          </DropdownMenuLinkItem>

          <DropdownMenuLinkItem
            render={<Link href="/tos" data-testid="header-terms-link" />}
            className="py-2 text-sm font-semibold text-muted-foreground"
          >
            {t('Terms of Use')}
          </DropdownMenuLinkItem>

          <LocaleSwitcherMenuItem />

          <DropdownMenuItem
            render={<button type="button" className="w-full text-destructive" />}
            className="py-2 text-sm font-semibold"
            nativeButton
            onClick={() => void handleLogout()}
          >
            {t('Logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
