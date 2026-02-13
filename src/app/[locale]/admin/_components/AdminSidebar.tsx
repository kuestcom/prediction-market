'use client'

import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import { BadgePercentIcon, LanguagesIcon, SettingsIcon, SwatchBookIcon, TagsIcon, TextSelectIcon, UsersIcon } from 'lucide-react'
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
    { id: 'categories', label: t('Categories'), href: '/admin/categories' as Route, icon: TagsIcon },
    { id: 'market-context', label: t('Market Context'), href: '/admin/market-context' as Route, icon: TextSelectIcon },
    { id: 'affiliate', label: t('Affiliate'), href: '/admin/affiliate' as Route, icon: BadgePercentIcon },
    { id: 'users', label: t('Users'), href: '/admin/users' as Route, icon: UsersIcon },
    { id: 'locales', label: t('Locales'), href: '/admin/locales' as Route, icon: LanguagesIcon },
  ]
  const pathname = usePathname()
  const activeItem = adminMenuItems.find(item => pathname === item.href)
  const active = activeItem?.id ?? 'general'

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <nav className="grid gap-1">
        {adminMenuItems.map(item => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            className={cn('h-11 justify-start text-foreground', { 'bg-accent hover:bg-accent': active === item.id })}
            asChild
          >
            <Link href={item.href}>
              <item.icon className="size-5 text-muted-foreground" />
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
    </aside>
  )
}
