'use client'

import type { Route } from 'next'
import type { ReactNode } from 'react'
import type { CategoryPathSidebarSlug } from '@/lib/constants'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface CategorySidebarProps {
  categorySlug: CategoryPathSidebarSlug
  categoryTitle: string
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
    <Link
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
    </Link>
  )
}

export default function CategorySidebar({
  categorySlug,
  categoryTitle,
  subcategories,
}: CategorySidebarProps) {
  const t = useExtracted()
  const pathname = usePathname()
  const { filters, updateFilters } = useFilters()

  const pathSubcategorySlug = useMemo(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments[0] !== categorySlug) {
      return null
    }

    return pathSegments.length === 2 ? pathSegments[1] : null
  }, [categorySlug, pathname])

  const activeSubcategorySlug = useMemo(() => {
    if (pathSubcategorySlug) {
      return pathSubcategorySlug
    }

    const belongsToCategory = filters.mainTag === categorySlug || filters.tag === categorySlug
    if (!belongsToCategory || filters.tag === categorySlug) {
      return null
    }

    return filters.tag
  }, [categorySlug, filters.mainTag, filters.tag, pathSubcategorySlug])

  function handleNavigate(targetTag: string) {
    updateFilters({ tag: targetTag, mainTag: categorySlug })
  }

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
        onClick={() => handleNavigate(categorySlug)}
      >
        {t('All')}
      </CategorySidebarLink>

      {subcategories.map(subcategory => (
        <CategorySidebarLink
          key={subcategory.slug}
          href={`/${categorySlug}/${subcategory.slug}` as Route}
          isActive={activeSubcategorySlug === subcategory.slug}
          onClick={() => handleNavigate(subcategory.slug)}
        >
          {subcategory.name}
        </CategorySidebarLink>
      ))}
    </nav>
  )
}
