'use client'

import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import { BadgePercentIcon, BellIcon, CoinsIcon, FingerprintIcon, UserIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface MenuItem {
  id: string
  label: string
  href: Route
  icon: LucideIcon
}

export default function SettingsSidebar() {
  const t = useExtracted()
  const pathname = usePathname()
  const menuItems: MenuItem[] = [
    { id: 'profile', label: t('Profile'), href: '/settings' as Route, icon: UserIcon },
    { id: 'notifications', label: t('Notifications'), href: '/settings/notifications' as Route, icon: BellIcon },
    { id: 'trading', label: t('Trading'), href: '/settings/trading' as Route, icon: CoinsIcon },
    { id: 'affiliate', label: t('Affiliate'), href: '/settings/affiliate' as Route, icon: BadgePercentIcon },
    { id: 'two-factor', label: t('Two-Factor Auth'), href: '/settings/two-factor' as Route, icon: FingerprintIcon },
  ]
  const activeItem = menuItems.find(item => pathname === item.href)
  const active = activeItem?.id ?? 'profile'

  return (
    <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
      <nav
        className={`
          flex w-full max-w-full snap-x snap-mandatory gap-2 overflow-x-auto rounded-sm
          lg:grid lg:gap-1 lg:overflow-visible lg:rounded-none lg:bg-transparent
        `}
      >
        {menuItems.map(item => (
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
