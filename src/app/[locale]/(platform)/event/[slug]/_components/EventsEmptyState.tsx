import { BarChart3Icon, SearchIcon, XIcon } from 'lucide-react'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { Button } from '@/components/ui/button'

interface EventsEmptyStateProps {
  onClearFilters?: () => void
  tag: string
  searchQuery: string
}

export default function EventsEmptyState({ onClearFilters, searchQuery, tag }: EventsEmptyStateProps) {
  const { updateFilters } = useFilters()

  function handleClearFilters() {
    if (onClearFilters) {
      onClearFilters()
      return
    }

    updateFilters({
      search: '',
      bookmarked: false,
      frequency: 'all',
      status: 'active',
      hideSports: false,
      hideCrypto: false,
      hideEarnings: false,
    })
  }

  return (
    <div className="col-span-full py-12 text-center">
      <div className="mb-2 flex justify-center text-muted-foreground">
        {searchQuery
          ? <SearchIcon className="size-6" />
          : <BarChart3Icon className="size-6" />}
      </div>

      <h3 className="mb-2 text-lg font-medium text-foreground">
        {searchQuery ? 'No events found' : 'No events available'}
      </h3>

      <p className="mb-6 text-sm text-muted-foreground">
        {searchQuery
          ? (
              <>
                Try adjusting your search for &ldquo;
                {searchQuery}
                &rdquo;
              </>
            )
          : (
              <>
                There are no events in the
                {' '}
                {tag}
                {' '}
                category with these
                filters
              </>
            )}
      </p>

      <Button type="button" onClick={handleClearFilters}>
        <XIcon />
        Clear filters
      </Button>
    </div>
  )
}
