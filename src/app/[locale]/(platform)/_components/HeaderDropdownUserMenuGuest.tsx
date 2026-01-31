'use client'

import { MenuIcon, UnplugIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
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
import { Link } from '@/i18n/navigation'

export default function HeaderDropdownUserMenuGuest() {
  const t = useExtracted()
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

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={handleWrapperPointerEnter}
      onPointerLeave={handleWrapperPointerLeave}
      className="font-medium"
    >
      <DropdownMenu
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
          onInteractOutside={() => setMenuOpen(false)}
          onEscapeKeyDown={() => setMenuOpen(false)}
        >
          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold text-foreground">
            <Link href="/docs/api" target="_blank" rel="noreferrer" className="flex w-full items-center gap-2">
              <UnplugIcon className="size-5 text-pink-500" />
              {t('APIs')}
            </Link>
          </DropdownMenuItem>

          <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-base font-semibold text-foreground">
            <span>{t('Dark Mode')}</span>
            <ThemeSelector />
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold text-muted-foreground">
            <Link href="/docs/users" data-testid="header-docs-link">{t('Documentation')}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="py-2.5 text-base font-semibold text-muted-foreground">
            <Link href="/terms-of-use" data-testid="header-terms-link">{t('Terms of Use')}</Link>
          </DropdownMenuItem>

          <LocaleSwitcherMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
