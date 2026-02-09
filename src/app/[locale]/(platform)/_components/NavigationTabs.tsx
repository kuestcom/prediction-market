'use cache'

import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import { Suspense } from 'react'
import NavigationMoreMenu from '@/app/[locale]/(platform)/_components/NavigationMoreMenu'
import NavigationTab from '@/app/[locale]/(platform)/_components/NavigationTab'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'

export default async function NavigationTabs({ locale }: { locale: string }) {
  setRequestLocale(locale)
  const t = await getExtracted()
  const resolvedLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
    ? locale as SupportedLocale
    : DEFAULT_LOCALE
  cacheTag(cacheTags.mainTags(resolvedLocale))
  const { data, globalChilds = [] } = await TagRepository.getMainTags(resolvedLocale)

  const sharedChilds = globalChilds.map(child => ({ ...child }))
  const baseTags = (data ?? []).map(tag => ({
    ...tag,
    childs: (tag.childs ?? []).map(child => ({ ...child })),
  }))

  const childParentMap = Object.fromEntries(
    baseTags.flatMap(tag => tag.childs.map(child => [child.slug, tag.slug])),
  ) as Record<string, string>

  const tags = [
    { slug: 'trending', name: t('Trending'), childs: sharedChilds },
    { slug: 'new', name: t('New'), childs: sharedChilds.map(child => ({ ...child })) },
    ...baseTags,
  ]

  return (
    <nav className="sticky top-15 z-20 bg-background md:top-17">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
      <div className="container mx-auto flex w-full min-w-0">
        <div
          id="navigation-main-tags"
          className={`
            flex h-12 w-full min-w-0 snap-x snap-mandatory scroll-px-3 items-center overflow-x-auto text-sm font-medium
          `}
        >
          {tags.map((tag, index) => (
            <div key={tag.slug} className="flex snap-start items-center">
              <Suspense fallback={<Skeleton className="h-8 w-16 rounded-sm" />}>
                <NavigationTab tag={tag} childParentMap={childParentMap} tabIndex={index} />
              </Suspense>

              {index === 1 && <div className="mx-3 h-5 w-px shrink-0 bg-border" />}
            </div>
          ))}
          <div className="flex snap-start items-center">
            <NavigationMoreMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
