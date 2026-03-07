'use client'

import type { Route } from 'next'
import type { ReactNode } from 'react'
import { useExtracted } from 'next-intl'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { cn } from '@/lib/utils'

interface CategorySidebarProps {
  activeSubcategorySlug: string | null
  categorySlug: string
  categoryTitle: string
  onNavigate: (targetTag: string) => void
  subcategories: { name: string, slug: string }[]
}

interface CategorySidebarLinkProps {
  children: ReactNode
  href: Route
  isActive: boolean
  onClick: () => void
}

function CategorySidebarLink({ children, href, isActive, onClick }: CategorySidebarLinkProps) {
  return (
    <IntentPrefetchLink
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-md p-3 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="truncate">{children}</span>
    </IntentPrefetchLink>
  )
}

export default function CategorySidebar({
  activeSubcategorySlug,
  categorySlug,
  categoryTitle,
  onNavigate,
  subcategories,
}: CategorySidebarProps) {
  const t = useExtracted()

  return (
    <nav
      aria-label={`${categoryTitle} subcategories`}
      className={`
        hidden h-[calc(100vh-9rem)] w-[190px] shrink-0 flex-col overflow-y-auto py-5 [scrollbar-width:none]
        lg:sticky lg:top-32 lg:flex lg:py-0
        [&::-webkit-scrollbar]:hidden
      `}
    >
      <CategorySidebarLink
        href={`/${categorySlug}` as Route}
        isActive={activeSubcategorySlug === null}
        onClick={() => onNavigate(categorySlug)}
      >
        {t('All')}
      </CategorySidebarLink>

      {subcategories.map(subcategory => (
        <CategorySidebarLink
          key={subcategory.slug}
          href={`/${categorySlug}/${subcategory.slug}` as Route}
          isActive={activeSubcategorySlug === subcategory.slug}
          onClick={() => onNavigate(subcategory.slug)}
        >
          {subcategory.name}
        </CategorySidebarLink>
      ))}
    </nav>
  )
}
