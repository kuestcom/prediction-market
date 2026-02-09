'use client'

import type { Route } from 'next'
import { Button } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'

interface AdminMenuItem {
  id: string
  label: string
  href: Route
}

const adminMenuItems: AdminMenuItem[] = [
  { id: 'general', label: 'General', href: '/admin' as Route },
  { id: 'theme', label: 'Theme', href: '/admin/theme' as Route },
  { id: 'categories', label: 'Categories', href: '/admin/categories' as Route },
  { id: 'market-context', label: 'Market Context', href: '/admin/market-context' as Route },
  { id: 'affiliate', label: 'Affiliate', href: '/admin/affiliate' as Route },
  { id: 'users', label: 'Users', href: '/admin/users' as Route },
  { id: 'locales', label: 'Locales', href: '/admin/locales' as Route },
]

export default function AdminSidebar() {
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
