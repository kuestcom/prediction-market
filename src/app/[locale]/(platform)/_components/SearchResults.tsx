import type { Route } from 'next'
import type { Event, PublicProfile, SearchLoadingStates, SearchResultItems } from '@/types'
import { ArrowRightIcon, LoaderIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import EventIconImage from '@/components/EventIconImage'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import ProfileLink from '@/components/ProfileLink'
import { buttonVariants } from '@/components/ui/button'
import { resolveEventPagePath } from '@/lib/events-routing'
import {
  buildSearchCategoryMatches,
  resolvePredictionResultsHref,
} from '@/lib/prediction-search'
import { cn } from '@/lib/utils'
import { SearchTabs } from './SearchTabs'

const EVENT_RESULTS_DROPDOWN_LIMIT = 5

interface SearchResultsProps {
  results: SearchResultItems
  isLoading: SearchLoadingStates
  activeTab: 'events' | 'profiles'
  query: string
  onResultClick: () => void
  onTabChange: (tab: 'events' | 'profiles') => void
}

export function SearchResults({
  results,
  isLoading,
  activeTab,
  query,
  onResultClick,
  onTabChange,
}: SearchResultsProps) {
  const t = useExtracted()
  const { events, profiles } = results

  const showTabs = query.length >= 2

  if ((isLoading.events && isLoading.profiles) && events.length === 0 && profiles.length === 0) {
    return (
      <div className={`
        absolute inset-x-0 top-full z-50 mt-0 w-full rounded-lg rounded-t-none border border-t-0 bg-background shadow-lg
      `}
      >
        {showTabs && (
          <SearchTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            eventCount={events.length}
            profileCount={profiles.length}
            isLoading={isLoading}
          />
        )}
        <div className="flex items-center justify-center p-4">
          <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('Searching...')}</span>
        </div>
      </div>
    )
  }

  if (query.length < 2 && !isLoading.events && !isLoading.profiles) {
    return <></>
  }

  return (
    <div
      data-testid="search-results"
      className={`
        absolute inset-x-0 top-full z-50 mt-0 rounded-lg rounded-t-none border border-t-0 bg-background shadow-lg
      `}
    >
      {showTabs && (
        <SearchTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          eventCount={events.length}
          profileCount={profiles.length}
          isLoading={isLoading}
        />
      )}

      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'events' && (
          <div id="events-panel" role="tabpanel" aria-labelledby="events-tab">
            {isLoading.events && events.length === 0
              ? (
                  <div className="flex items-center justify-center p-4">
                    <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">{t('Searching events...')}</span>
                  </div>
                )
              : (
                  <EventResults events={events} query={query} isLoading={isLoading.events} onResultClick={onResultClick} />
                )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <div id="profiles-panel" role="tabpanel" aria-labelledby="profiles-tab">
            <ProfileResults
              profiles={profiles}
              isLoading={isLoading.profiles}
              query={query}
              onResultClick={onResultClick}
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface EventResultsProps {
  events: Event[]
  query: string
  isLoading: boolean
  onResultClick: () => void
}

function EventResults({ events, query, isLoading, onResultClick }: EventResultsProps) {
  const t = useExtracted()
  const { tags } = usePlatformNavigationData()
  const categories = buildSearchCategoryMatches(tags, query)
  const allResultsHref = resolvePredictionResultsHref(query, categories) as Route | null
  const visibleEvents = events.slice(0, EVENT_RESULTS_DROPDOWN_LIMIT)

  if (events.length === 0 && categories.length === 0 && !allResultsHref && !isLoading && query.length >= 2) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t('No events found')}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b px-3 py-2">
          {categories.map(category => (
            <IntentPrefetchLink
              key={category.href}
              href={category.href}
              onClick={onResultClick}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-lg')}
            >
              <span className="truncate">{category.label}</span>
            </IntentPrefetchLink>
          ))}
        </div>
      )}

      {events.length === 0 && !isLoading && query.length >= 2 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {t('No events found')}
        </div>
      )}

      {visibleEvents.map((result) => {
        const isResolvedEvent = result.status === 'resolved'

        return (
          <IntentPrefetchLink
            key={`${result.id}-${result.slug}`}
            href={resolveEventPagePath(result)}
            onClick={onResultClick}
            data-testid="search-result-item"
            className={cn(
              'flex items-center justify-between p-3 transition-colors hover:bg-accent',
              { 'last:rounded-b-lg': !allResultsHref },
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="size-8 shrink-0 overflow-hidden rounded-sm">
                <EventIconImage
                  src={result.icon_url}
                  alt={result.title}
                  sizes="32px"
                  containerClassName={cn('size-full', isResolvedEvent && 'opacity-65')}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className={cn('truncate text-sm font-medium', isResolvedEvent
                  ? 'text-muted-foreground'
                  : `text-foreground`)}
                >
                  {result.title}
                </h3>
              </div>
            </div>

            <div className="flex flex-col items-end text-right">
              <span className={cn('text-lg font-bold', isResolvedEvent ? 'text-muted-foreground' : 'text-foreground')}>
                {result.markets[0].probability.toFixed(0)}
                %
              </span>
            </div>
          </IntentPrefetchLink>
        )
      })}

      {allResultsHref && (
        <IntentPrefetchLink
          href={allResultsHref}
          onClick={onResultClick}
          className={`
            flex items-center justify-between gap-2 rounded-b-lg border-t p-3 text-sm font-medium text-primary
            transition-colors
            hover:bg-accent hover:text-primary
          `}
        >
          <span>{t('See all results')}</span>
          <ArrowRightIcon className="size-4" />
        </IntentPrefetchLink>
      )}
    </div>
  )
}

interface ProfileResultsProps {
  profiles: PublicProfile[]
  isLoading: boolean
  query: string
  onResultClick: () => void
}

function ProfileResults({ profiles, isLoading, query, onResultClick }: ProfileResultsProps) {
  const t = useExtracted()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">{t('Searching...')}</span>
      </div>
    )
  }

  if (profiles.length === 0 && query.length >= 2) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t('No profiles found')}
      </div>
    )
  }

  if (profiles.length === 0) {
    return <></>
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {profiles.map(profile => (
        <div
          key={profile.proxy_wallet_address}
          onClick={onResultClick}
          className="cursor-pointer px-3 transition-colors last:rounded-b-lg hover:bg-accent"
        >
          <ProfileLink
            user={{
              address: profile.proxy_wallet_address!,
              proxy_wallet_address: profile.proxy_wallet_address,
              username: profile.username,
              image: profile.image,
            }}
            joinedAt={`${profile.created_at}`}
          />
        </div>
      ))}
    </div>
  )
}
