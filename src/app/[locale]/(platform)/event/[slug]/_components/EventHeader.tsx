import type { PlatformNavigationTag } from '@/lib/platform-navigation'
import type { Event } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import EventShare from '@/app/[locale]/(platform)/event/[slug]/_components/EventShare'
import EventIconImage from '@/components/EventIconImage'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { isDynamicHomeCategorySlug } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

interface EventHeaderProps {
  event: Event
}

interface EventHeaderTaxonomyItemData {
  href: string | null
  label: string
}

interface EventHeaderTaxonomy {
  category: EventHeaderTaxonomyItemData
  subcategory: EventHeaderTaxonomyItemData | null
}

function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function resolveEventHeaderTaxonomy({
  event,
  childParentMap,
  tags,
}: {
  childParentMap: Record<string, string>
  event: Event
  tags: PlatformNavigationTag[]
}): EventHeaderTaxonomy | null {
  const normalizedEventTags = event.tags
    .map(tag => ({
      isMainCategory: tag.isMainCategory,
      label: tag.name.trim(),
      slug: normalizeTagSlug(tag.slug),
    }))
    .filter(tag => tag.slug.length > 0)

  const mainEventTag = normalizedEventTags.find(tag => tag.isMainCategory && isDynamicHomeCategorySlug(tag.slug)) ?? null
  const fallbackTaggedSubcategory = normalizedEventTags.find(tag => !tag.isMainCategory && childParentMap[tag.slug]) ?? null
  const resolvedMainSlug = mainEventTag?.slug ?? (
    fallbackTaggedSubcategory
      ? normalizeTagSlug(childParentMap[fallbackTaggedSubcategory.slug])
      : ''
  )

  const navigationMainTag = tags.find(tag => normalizeTagSlug(tag.slug) === resolvedMainSlug) ?? null
  const categoryLabel = navigationMainTag?.name.trim() || mainEventTag?.label || event.main_tag?.trim() || null

  if (!categoryLabel) {
    return null
  }

  const nonMainEventTags = normalizedEventTags.filter(tag => !tag.isMainCategory && tag.slug !== resolvedMainSlug)
  const nonMainEventTagSlugs = new Set(nonMainEventTags.map(tag => tag.slug))
  const matchedSubcategory = navigationMainTag?.childs.find(child => nonMainEventTagSlugs.has(normalizeTagSlug(child.slug))) ?? null
  const fallbackSubcategory = matchedSubcategory
    ? null
    : nonMainEventTags[0] ?? null

  return {
    category: {
      href: navigationMainTag ? `/${resolvedMainSlug}` : null,
      label: categoryLabel,
    },
    subcategory: matchedSubcategory
      ? {
          href: `/${resolvedMainSlug}/${normalizeTagSlug(matchedSubcategory.slug)}`,
          label: matchedSubcategory.name.trim(),
        }
      : fallbackSubcategory
        ? {
            href: null,
            label: fallbackSubcategory.label,
          }
        : null,
  }
}

function EventHeaderTaxonomyItem({
  href,
  label,
  className,
}: EventHeaderTaxonomyItemData & { className?: string }) {
  if (href) {
    return (
      <IntentPrefetchLink
        href={href}
        className={cn('block truncate transition-colors hover:text-foreground', className)}
        title={label}
      >
        {label}
      </IntentPrefetchLink>
    )
  }

  return (
    <span className={cn('block truncate', className)} title={label}>
      {label}
    </span>
  )
}

export default function EventHeader({ event }: EventHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const { childParentMap, tags } = usePlatformNavigationData()
  const taxonomy = useMemo(
    () => resolveEventHeaderTaxonomy({
      event,
      childParentMap,
      tags,
    }),
    [childParentMap, event, tags],
  )

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={cn(
        'relative z-10 -mx-4 flex items-center gap-3 px-4 transition-all ease-in-out',
        { 'sticky top-26 translate-y-1 bg-background py-3 pr-6 md:translate-y-3 lg:top-28 lg:translate-y-1': scrolled },
      )}
    >
      {scrolled && (
        <span className="pointer-events-none absolute inset-x-4 bottom-0 border-b" />
      )}
      <div className="relative z-10 flex flex-1 items-center gap-2 lg:gap-4">
        <div
          className={cn(
            'shrink-0 rounded-sm transition-all ease-in-out dark:bg-foreground',
            scrolled ? 'size-10' : 'size-10 lg:size-16',
          )}
        >
          <EventIconImage
            src={event.icon_url}
            alt={event.creator || 'Market creator'}
            sizes={scrolled ? '40px' : '(min-width: 1024px) 64px, 40px'}
            containerClassName="size-full rounded-sm"
          />
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col items-start transition-all ease-in-out',
            scrolled ? 'justify-center gap-0' : 'justify-start gap-0.5',
          )}
        >
          {taxonomy && (
            <div
              className={cn(
                `
                  flex max-w-full min-w-0 items-center gap-1 overflow-hidden text-muted-foreground transition-all
                  ease-in-out
                `,
                scrolled
                  ? 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
                  : 'max-h-6 translate-y-0 text-xs opacity-100 lg:text-sm',
              )}
              aria-hidden={scrolled}
            >
              <EventHeaderTaxonomyItem
                {...taxonomy.category}
                className={taxonomy.subcategory ? 'min-w-0' : 'max-w-full min-w-0'}
              />

              {taxonomy.subcategory && (
                <>
                  <span className="shrink-0" aria-hidden>
                    ·
                  </span>
                  <EventHeaderTaxonomyItem
                    {...taxonomy.subcategory}
                    className="min-w-0 flex-1"
                  />
                </>
              )}
            </div>
          )}

          <h1 className={cn(
            'min-w-0 leading-tight! font-semibold text-pretty transition-all ease-in-out',
            scrolled ? 'text-sm lg:text-base' : 'text-xl lg:text-2xl',
          )}
          >
            {event.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 text-foreground">
        <EventShare event={event} />
        <EventBookmark event={event} />
      </div>
    </div>
  )
}
