'use client'

import type { Route } from 'next'
import type { ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import { resolveSportsTitleBySlug } from '@/app/[locale]/(platform)/sports/_components/sportsRouteUtils'
import SportsSidebarMenu from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface SportsLayoutShellProps {
  children: ReactNode
  sportsCountsBySlug?: Record<string, number>
}

interface SportsPathContext {
  isEventRoute: boolean
  mode: 'all' | 'live' | 'futures'
  activeTagSlug: string | null
  sportSlug: string | null
  section: 'games' | 'props' | null
  title: string
}

function getSportsPathContext(pathname: string): SportsPathContext {
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
      title: 'All Sports',
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
      title: 'All Sports',
    }
  }

  if (second === 'live') {
    return {
      isEventRoute: false,
      mode: 'live',
      activeTagSlug: null,
      sportSlug: null,
      section: null,
      title: 'Live',
    }
  }

  if (second === 'futures') {
    return {
      isEventRoute: false,
      mode: 'futures',
      activeTagSlug: third ?? null,
      sportSlug: third ?? null,
      section: null,
      title: 'Futures',
    }
  }

  const section = third === 'props' ? 'props' : 'games'
  const isListRoute = third === 'games' || third === 'props' || third === undefined
  if (isListRoute) {
    return {
      isEventRoute: false,
      mode: 'all',
      activeTagSlug: second,
      sportSlug: second,
      section,
      title: resolveSportsTitleBySlug(second) ?? 'All Sports',
    }
  }

  return {
    isEventRoute: true,
    mode: 'all',
    activeTagSlug: second,
    sportSlug: second,
    section: null,
    title: resolveSportsTitleBySlug(second) ?? 'All Sports',
  }
}

export default function SportsLayoutShell({
  children,
  sportsCountsBySlug = {},
}: SportsLayoutShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const context = useMemo(() => getSportsPathContext(pathname), [pathname])

  const handleNavigateHref = useCallback((href: string) => {
    router.push(href as Route)
  }, [router])

  const handleSelectSportsTag = useCallback((_requestedTagSlug: string, href: string) => {
    router.push(href as Route)
  }, [router])
  const showSportSectionPills = context.mode === 'all' && Boolean(context.sportSlug) && !context.isEventRoute
  const activeSection = context.section ?? 'games'

  if (context.isEventRoute) {
    return <>{children}</>
  }

  return (
    <main className="container py-4">
      <div className="relative w-full lg:flex lg:items-start lg:gap-4">
        <SportsSidebarMenu
          mode={context.mode}
          activeTagSlug={context.activeTagSlug}
          onSelectMode={() => {}}
          onSelectTagSlug={handleSelectSportsTag}
          onNavigateHref={handleNavigateHref}
          countByTagSlug={sportsCountsBySlug}
        />
        <div className="min-w-0 flex-1">
          <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground lg:mt-2 lg:ml-4">
            {context.title}
          </h1>
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
