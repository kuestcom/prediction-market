'use client'

import { useDisconnect } from '@reown/appkit-controllers/react'
import { BadgePercentIcon, ChevronDownIcon, SettingsIcon, TrophyIcon, UnplugIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import LocaleSwitcherMenuItem from '@/components/LocaleSwitcherMenuItem'
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
import { useIsMobile } from '@/hooks/useIsMobile'
import { Link, usePathname } from '@/i18n/navigation'
import { useUser } from '@/stores/useUser'

export default function HeaderDropdownUserMenuAuth() {
  const t = useExtracted()
  const { disconnect } = useDisconnect()
  const user = useUser()
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearCloseTimeout(), [])

  function relatedTargetIsWithin(ref: React.RefObject<HTMLElement | null>, relatedTarget: EventTarget | null) {
    if (!relatedTarget) {
      return false
    }

    return Boolean(ref.current?.contains(relatedTarget as Node))
  }

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function handleWrapperPointerEnter() {
    clearCloseTimeout()
    setMenuOpen(true)
  }

  function handleWrapperPointerLeave(event: React.PointerEvent) {
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

  if (!user) {
    return <></>
  }

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={handleWrapperPointerEnter}
      onPointerLeave={handleWrapperPointerLeave}
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
            className={`
              group flex cursor-pointer items-center gap-2 px-2 transition-colors
              hover:bg-accent/70 hover:text-accent-foreground
              data-[state=open]:bg-accent/70 data-[state=open]:text-accent-foreground
            `}
            data-testid="header-menu-button"
          >
            <Image
              src={user.image}
              alt="User avatar"
              width={32}
              height={32}
              className="aspect-square shrink-0 rounded-full object-cover"
            />
            <ChevronDownIcon className={`
              size-4 transition-transform duration-150
              group-hover:rotate-180
              group-data-[state=open]:rotate-180
            `}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-64"
          align="end"
          sideOffset={0}
          collisionPadding={16}
          portalled={false}
          onInteractOutside={() => setMenuOpen(false)}
          onEscapeKeyDown={() => setMenuOpen(false)}
        >
          <DropdownMenuItem asChild>
            <UserInfoSection />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
            <Link href="/settings" className="flex w-full items-center gap-2">
              <SettingsIcon className="size-5 text-orange-500" />
              {t('Settings')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
            <Link href="/leaderboard" className="flex w-full items-center gap-2">
              <TrophyIcon className="size-5 text-amber-500" />
              {t('Leaderboard')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
            <Link href="/settings/affiliate" className="flex w-full items-center gap-2">
              <BadgePercentIcon className="size-5 text-emerald-600" />
              {t('Affiliate')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
            <Link href="/docs/api" target="_blank" rel="noreferrer" className="flex w-full items-center gap-2">
              <UnplugIcon className="size-5 text-pink-500" />
              {t('APIs')}
            </Link>
          </DropdownMenuItem>

          {user?.is_admin && (
            <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
              <Link href="/admin">{t('Admin')}</Link>
            </DropdownMenuItem>
          )}

          <div className="flex items-center justify-between gap-3 px-2 text-base font-semibold">
            <span>{t('Dark Mode')}</span>
            <ThemeSelector />
          </div>

          {isMobile && (
            <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
              <div className="flex justify-center" onClickCapture={handleMenuClose}>
                <HeaderPortfolio />
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold text-muted-foreground">
            <Link href="/docs/users" data-testid="header-docs-link">{t('Documentation')}</Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold text-muted-foreground">
            <Link href="/terms-of-use" data-testid="header-terms-link">{t('Terms of Use')}</Link>
          </DropdownMenuItem>

          <LocaleSwitcherMenuItem />

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold">
            <button type="button" className="w-full text-destructive" onClick={() => disconnect()}>
              {t('Logout')}
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
