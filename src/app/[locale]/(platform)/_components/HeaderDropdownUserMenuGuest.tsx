'use client'

import { DownloadIcon, MenuIcon, TrophyIcon, UnplugIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AppLink from '@/components/AppLink'
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
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePwaInstall } from '@/hooks/usePwaInstall'

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

function useHoverDropdownMenu(enableHoverOpen: boolean) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(function clearMenuCloseTimeoutOnUnmount() {
    const timeoutRefSnapshot = closeTimeoutRef
    return function cleanupMenuCloseTimeout() {
      if (timeoutRefSnapshot.current) {
        clearTimeout(timeoutRefSnapshot.current)
        timeoutRefSnapshot.current = null
      }
    }
  }, [])

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

  function handleOpenChange(nextOpen: boolean) {
    clearCloseTimeout()
    setMenuOpen(nextOpen)
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return {
    menuOpen,
    wrapperRef,
    handleWrapperPointerEnter,
    handleWrapperPointerLeave,
    handleOpenChange,
    closeMenu,
  }
}

export default function HeaderDropdownUserMenuGuest() {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const { canShowInstallUi, isIos, isPrompting, requestInstall } = usePwaInstall()
  const enableHoverOpen = !isMobile
  const {
    menuOpen,
    wrapperRef,
    handleWrapperPointerEnter,
    handleWrapperPointerLeave,
    handleOpenChange,
    closeMenu,
  } = useHoverDropdownMenu(enableHoverOpen)

  async function handleInstallAction() {
    closeMenu()

    if (isIos) {
      toast.info(t('Install app'), {
        duration: 10_000,
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

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={enableHoverOpen ? handleWrapperPointerEnter : undefined}
      onPointerLeave={enableHoverOpen ? handleWrapperPointerLeave : undefined}
      className="font-medium"
    >
      <DropdownMenu
        open={menuOpen}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="headerIconCompact"
            data-testid="header-menu-button"
          >
            <MenuIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-60"
          align="end"
          collisionPadding={16}
          portalled={false}
          onInteractOutside={closeMenu}
          onEscapeKeyDown={closeMenu}
        >
          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-foreground">
            <AppLink intentPrefetch href="/leaderboard" className="flex w-full items-center gap-1.5">
              <TrophyIcon className="size-4 text-amber-500" />
              {t('Leaderboard')}
            </AppLink>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-foreground">
            <AppLink
              intentPrefetch
              href="/docs/api-reference"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-1.5"
            >
              <UnplugIcon className="size-4 text-pink-500" />
              {t('APIs')}
            </AppLink>
          </DropdownMenuItem>

          {canShowInstallUi && (
            <DropdownMenuItem
              className="py-2 text-sm font-semibold text-foreground"
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

          <div className="flex items-center justify-between gap-2 px-2 py-1 text-sm font-semibold text-foreground">
            <span>{t('Dark Mode')}</span>
            <ThemeSelector />
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-muted-foreground">
            <AppLink intentPrefetch href="/docs" data-testid="header-docs-link">{t('Documentation')}</AppLink>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="py-2 text-sm font-semibold text-muted-foreground">
            <AppLink intentPrefetch href="/tos" data-testid="header-terms-link">{t('Terms of Use')}</AppLink>
          </DropdownMenuItem>

          <LocaleSwitcherMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
