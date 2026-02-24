'use client'

import type { Route } from 'next'
import type { ReactNode } from 'react'
import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import { useCallback, useMemo } from 'react'
import SportsSidebarMenu from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface SportsLayoutShellProps {
  children: ReactNode
  sportsCountsBySlug?: Record<string, number>
  sportsMenuEntries: SportsMenuEntry[]
  canonicalSlugByAliasKey: Record<string, string>
  h1TitleBySlug: Record<string, string>
  sectionsBySlug: Record<string, { gamesEnabled: boolean, propsEnabled: boolean }>
}

interface SportsPathContext {
  isEventRoute: boolean
  mode: 'all' | 'live' | 'futures'
  activeTagSlug: string | null
  sportSlug: string | null
  section: 'games' | 'props' | null
  title: string
}

function stripDiacritics(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
}

function normalizeAliasKey(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  return normalized || null
}

function resolveCanonicalSlugFromAlias(
  canonicalSlugByAliasKey: Record<string, string>,
  alias: string | null | undefined,
) {
  const aliasKey = normalizeAliasKey(alias)
  if (!aliasKey) {
    return null
  }

  return canonicalSlugByAliasKey[aliasKey] ?? null
}

function resolveMenuLabelByHref(menuEntries: SportsMenuEntry[], href: string) {
  for (const entry of menuEntries) {
    if (entry.type === 'link' && entry.href === href) {
      return entry.label
    }

    if (entry.type === 'group') {
      const link = entry.links.find(linkEntry => linkEntry.href === href)
      if (link) {
        return link.label
      }
    }
  }

  return ''
}

function getSportsPathContext(params: {
  pathname: string
  menuEntries: SportsMenuEntry[]
  canonicalSlugByAliasKey: Record<string, string>
  h1TitleBySlug: Record<string, string>
}): SportsPathContext {
  const {
    pathname,
    menuEntries,
    canonicalSlugByAliasKey,
    h1TitleBySlug,
  } = params
  const segments = pathname
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean)

  if (segments[0] !== 'sports') {
    return {
      isEventRoute: false,
      mode: 'all',
      activeTagSlug: null,
      sportSlug: null,
      section: null,
      title: '',
    }
  }

  const [_, second, third] = segments

  if (!second) {
    return {
      isEventRoute: false,
      mode: 'all',
      activeTagSlug: null,
      sportSlug: null,
      section: null,
      title: '',
    }
  }

  if (second === 'live') {
    return {
      isEventRoute: false,
      mode: 'live',
      activeTagSlug: null,
      sportSlug: null,
      section: null,
      title: resolveMenuLabelByHref(menuEntries, '/sports/live'),
    }
  }

  if (second === 'futures') {
    const canonicalSportSlug = resolveCanonicalSlugFromAlias(canonicalSlugByAliasKey, third)

    return {
      isEventRoute: false,
      mode: 'futures',
      activeTagSlug: canonicalSportSlug,
      sportSlug: canonicalSportSlug,
      section: null,
      title: h1TitleBySlug[canonicalSportSlug ?? ''] ?? '',
    }
  }

  const canonicalSportSlug = resolveCanonicalSlugFromAlias(canonicalSlugByAliasKey, second)
  const section = third === 'props' ? 'props' : 'games'
  const isListRoute = third === 'games' || third === 'props' || third === undefined

  if (isListRoute) {
    return {
      isEventRoute: false,
      mode: 'all',
      activeTagSlug: canonicalSportSlug,
      sportSlug: canonicalSportSlug,
      section,
      title: h1TitleBySlug[canonicalSportSlug ?? ''] ?? '',
    }
  }

  return {
    isEventRoute: true,
    mode: 'all',
    activeTagSlug: canonicalSportSlug,
    sportSlug: canonicalSportSlug,
    section: null,
    title: h1TitleBySlug[canonicalSportSlug ?? ''] ?? '',
  }
}

export default function SportsLayoutShell({
  children,
  sportsCountsBySlug = {},
  sportsMenuEntries,
  canonicalSlugByAliasKey,
  h1TitleBySlug,
  sectionsBySlug,
}: SportsLayoutShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const context = useMemo(
    () => getSportsPathContext({
      pathname,
      menuEntries: sportsMenuEntries,
      canonicalSlugByAliasKey,
      h1TitleBySlug,
    }),
    [pathname, sportsMenuEntries, canonicalSlugByAliasKey, h1TitleBySlug],
  )

  const handleNavigateHref = useCallback((href: string) => {
    router.push(href as Route)
  }, [router])

  const handleSelectSportsTag = useCallback((_requestedTagSlug: string, href: string) => {
    router.push(href as Route)
  }, [router])

  const sectionConfig = context.sportSlug ? sectionsBySlug[context.sportSlug] : null
  const showSportSectionPills = context.mode === 'all'
    && Boolean(context.sportSlug)
    && !context.isEventRoute
    && Boolean(sectionConfig?.gamesEnabled && sectionConfig?.propsEnabled)
  const activeSection = context.section ?? 'games'

  if (context.isEventRoute) {
    return <>{children}</>
  }

  return (
    <main className="container py-4">
      <div className="relative w-full lg:flex lg:items-start lg:gap-4">
        <SportsSidebarMenu
          entries={sportsMenuEntries}
          mode={context.mode}
          activeTagSlug={context.activeTagSlug}
          onSelectMode={() => {}}
          onSelectTagSlug={handleSelectSportsTag}
          onNavigateHref={handleNavigateHref}
          countByTagSlug={sportsCountsBySlug}
        />
        <div className="min-w-0 flex-1">
          {context.title && (
            <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground lg:mt-2 lg:ml-4">
              {context.title}
            </h1>
          )}
          {showSportSectionPills && context.sportSlug && (
            <div className="mb-4 flex items-center gap-3 lg:ml-4">
              <button
                type="button"
                onClick={() => router.push(`/sports/${context.sportSlug}/games` as Route)}
                className={cn(
                  'rounded-full bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors',
                  activeSection === 'games' && 'bg-primary text-primary-foreground',
                )}
              >
                Games
              </button>
              <button
                type="button"
                onClick={() => router.push(`/sports/${context.sportSlug}/props` as Route)}
                className={cn(
                  'rounded-full bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors',
                  activeSection === 'props' && 'bg-primary text-primary-foreground',
                )}
              >
                Props
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  )
}
