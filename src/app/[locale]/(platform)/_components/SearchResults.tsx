import type { Event, PublicProfile, SearchLoadingStates, SearchResultItems } from '@/types'
import { LoaderIcon } from 'lucide-react'
import Image from 'next/image'
import ProfileLink from '@/components/ProfileLink'
import { Link } from '@/i18n/navigation'
import { SearchTabs } from './SearchTabs'

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
          <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
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
                    <span className="ml-2 text-sm text-muted-foreground">Searching events...</span>
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
  if (events.length === 0 && !isLoading && query.length >= 2) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No events found
      </div>
    )
  }

  if (events.length === 0) {
    return <></>
  }

  return (
    <>
      {events.map(result => (
        <Link
          key={`${result.id}-${result.slug}`}
          href={`/event/${result.slug}`}
          onClick={onResultClick}
          data-testid="search-result-item"
          className="flex items-center justify-between p-3 transition-colors last:rounded-b-lg hover:bg-accent"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-8 shrink-0 overflow-hidden rounded-sm">
              <Image
                src={result.icon_url}
                alt={result.title}
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-foreground">
                {result.title}
              </h3>
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-lg font-bold text-foreground">
              {result.markets[0].probability.toFixed(0)}
              %
            </span>
          </div>
        </Link>
      ))}
    </>
  )
}

interface ProfileResultsProps {
  profiles: PublicProfile[]
  isLoading: boolean
  query: string
  onResultClick: () => void
}

function ProfileResults({ profiles, isLoading, query, onResultClick }: ProfileResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
      </div>
    )
  }

  if (profiles.length === 0 && query.length >= 2) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No profiles found
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
