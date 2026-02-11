'use client'

import type { Route } from 'next'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Link, usePathname } from '@/i18n/navigation'

interface AdminMenuItem {
  id: string
  label: string
  href: Route
}

export default function AdminSidebar() {
  const t = useExtracted()
  const adminMenuItems: AdminMenuItem[] = [
    { id: 'general', label: t('General'), href: '/admin' as Route },
    { id: 'theme', label: t('Theme'), href: '/admin/theme' as Route },
    { id: 'categories', label: t('Categories'), href: '/admin/categories' as Route },
    { id: 'market-context', label: t('Market Context'), href: '/admin/market-context' as Route },
    { id: 'affiliate', label: t('Affiliate'), href: '/admin/affiliate' as Route },
    { id: 'users', label: t('Users'), href: '/admin/users' as Route },
    { id: 'locales', label: t('Locales'), href: '/admin/locales' as Route },
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
