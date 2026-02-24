'use client'

import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import { BadgePercentIcon, CalendarPlusIcon, LanguagesIcon, SettingsIcon, SwatchBookIcon, TagsIcon, TextSelectIcon, UsersIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface AdminMenuItem {
  id: string
  label: string
  href: Route
  icon: LucideIcon
}

export default function AdminSidebar() {
  const t = useExtracted()
  const adminMenuItems: AdminMenuItem[] = [
    { id: 'general', label: t('General'), href: '/admin' as Route, icon: SettingsIcon },
    { id: 'theme', label: t('Theme'), href: '/admin/theme' as Route, icon: SwatchBookIcon },
    { id: 'locales', label: t('Locales'), href: '/admin/locales' as Route, icon: LanguagesIcon },
    { id: 'categories', label: t('Categories'), href: '/admin/categories' as Route, icon: TagsIcon },
    { id: 'market-context', label: t('Market Context'), href: '/admin/market-context' as Route, icon: TextSelectIcon },
    { id: 'affiliate', label: t('Affiliate'), href: '/admin/affiliate' as Route, icon: BadgePercentIcon },
    { id: 'create-event', label: t('Create Event'), href: '/admin/create-event' as Route, icon: CalendarPlusIcon },
    { id: 'users', label: t('Users'), href: '/admin/users' as Route, icon: UsersIcon },
  ]
  const pathname = usePathname()
  const activeItem = adminMenuItems.find(item => pathname === item.href)
  const active = activeItem?.id ?? 'general'

  return (
    <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
      <nav
        className={`
          flex w-full max-w-full snap-x snap-mandatory gap-2 overflow-x-auto rounded-sm
          lg:grid lg:gap-1 lg:overflow-visible lg:rounded-none lg:bg-transparent
        `}
      >
        {adminMenuItems.map(item => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            className={cn(
              `
                h-auto shrink-0 snap-start flex-col gap-1.5 px-3 py-2 text-foreground
                lg:h-11 lg:min-w-0 lg:flex-row lg:justify-start lg:gap-2 lg:px-4 lg:py-2
              `,
              { 'bg-accent hover:bg-accent': active === item.id },
            )}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="size-6 text-muted-foreground lg:size-5" />
              <span>{item.label}</span>
            </Link>
          </Button>
        ))}
      </nav>
    </aside>
  )
}
