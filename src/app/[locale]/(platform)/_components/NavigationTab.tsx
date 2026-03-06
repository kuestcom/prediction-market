'use client'

import type { Route } from 'next'
import type { PlatformNavigationTag } from '@/lib/platform-navigation'
import { TrendingUpIcon } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface NavigationTabProps {
  containerRef?: (element: HTMLSpanElement | null) => void
  href: Route
  isActive: boolean
  onClick?: () => void
  tabPaddingClass: string
  tag: Pick<PlatformNavigationTag, 'name' | 'slug'>
}

export default function NavigationTab({
  tag,
  href,
  isActive,
  onClick,
  tabPaddingClass,
  containerRef,
}: NavigationTabProps) {
  return (
    <span ref={containerRef}>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          'inline-flex h-full items-center justify-center rounded-md py-1 whitespace-nowrap',
          tabPaddingClass,
          { 'gap-2': tag.slug === 'trending' },
          isActive
            ? 'border-primary font-semibold text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        {tag.slug === 'trending' && <TrendingUpIcon className="size-4" />}
        <span>{tag.name}</span>
      </Link>
    </span>
  )
}
