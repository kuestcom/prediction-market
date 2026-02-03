'use client'

import type { Route } from 'next'
import { Button } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'

interface MenuItem {
  id: string
  label: string
  href: Route
}

const menuItems: MenuItem[] = [
  { id: 'profile', label: 'Profile', href: '/settings' as Route },
  { id: 'notifications', label: 'Notifications', href: '/settings/notifications' as Route },
  { id: 'trading', label: 'Trading', href: '/settings/trading' as Route },
  { id: 'affiliate', label: 'Affiliate', href: '/settings/affiliate' as Route },
  { id: 'two-factor', label: 'Two-Factor Auth', href: '/settings/two-factor' as Route },
]

export default function SettingsSidebar() {
  const pathname = usePathname()
  const activeItem = menuItems.find(item => pathname === item.href)
  const active = activeItem?.id ?? 'profile'

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <nav className="grid gap-1">
        {menuItems.map(item => (
          <Button
            key={item.id}
            type="button"
            variant={active === item.id ? 'outline' : 'ghost'}
            className="justify-start text-muted-foreground"
            asChild
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>
    </aside>
  )
}
