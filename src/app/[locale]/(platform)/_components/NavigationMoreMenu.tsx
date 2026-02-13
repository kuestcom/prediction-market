'use client'

import { ActivityIcon, ChevronDownIcon, TrophyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export default function NavigationMoreMenu() {
  const t = useExtracted()
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const handleEnter = useCallback(() => {
    clearCloseTimeout()
    setOpen(true)
  }, [clearCloseTimeout])

  const handleLeave = useCallback(() => {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
    }, 120)
  }, [clearCloseTimeout])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          variant="ghost"
          size="sm"
          className={cn(
            'group h-8 shrink-0 bg-transparent text-sm whitespace-nowrap',
            'hover:bg-transparent dark:hover:bg-transparent',
            open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>{t('More')}</span>
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={6}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="min-w-36"
      >
        <DropdownMenuItem
          asChild
          className={`
            group flex w-full items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-muted-foreground
            transition-colors
            hover:text-foreground
          `}
        >
          <Link href="/activity">
            <ActivityIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            <span>{t('Activity')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className={`
            group flex w-full items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-muted-foreground
            transition-colors
            hover:text-foreground
          `}
        >
          <Link href="/leaderboard">
            <TrophyIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            <span>{t('Leaderboard')}</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
