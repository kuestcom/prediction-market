import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import { ArrowDownNarrowWideIcon, DownloadIcon, ListFilterIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import SearchSortToolbar, { SearchSortSelect } from '@/app/[locale]/(platform)/_components/SearchSortToolbar'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'

interface PublicActivityFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  typeFilter: ActivityTypeFilter
  onTypeChange: (value: ActivityTypeFilter) => void
  sortFilter: ActivitySort
  onSortChange: (value: ActivitySort) => void
  onExport: () => void
  disableExport: boolean
}

export default function PublicActivityFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeChange,
  sortFilter,
  onSortChange,
  onExport,
  disableExport,
}: PublicActivityFiltersProps) {
  const t = useExtracted()

  return (
    <SearchSortToolbar
      searchQuery={searchQuery}
      searchPlaceholder={t('Search activity...')}
      onSearchChange={onSearchChange}
      controls={(
        <>
          <SearchSortSelect
            value={typeFilter}
            ariaLabel={t('Filter activity type')}
            icon={<ListFilterIcon className="size-4 text-muted-foreground" />}
            onValueChange={value => onTypeChange(value as ActivityTypeFilter)}
          >
            <SelectItem value="all">{t('All')}</SelectItem>
            <SelectItem value="trades">{t('Trades')}</SelectItem>
            <SelectItem value="buy">{t('Buy')}</SelectItem>
            <SelectItem value="merge">{t('Merge')}</SelectItem>
            <SelectItem value="redeem">{t('Redeem')}</SelectItem>
          </SearchSortSelect>

          <SearchSortSelect
            value={sortFilter}
            ariaLabel={t('Sort activity')}
            icon={<ArrowDownNarrowWideIcon className="size-4 text-muted-foreground" />}
            onValueChange={value => onSortChange(value as ActivitySort)}
          >
            <SelectItem value="newest">{t('Newest')}</SelectItem>
            <SelectItem value="oldest">{t('Oldest')}</SelectItem>
            <SelectItem value="value">{t('Value')}</SelectItem>
            <SelectItem value="shares">{t('Shares')}</SelectItem>
          </SearchSortSelect>
        </>
      )}
      action={(
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onExport}
          disabled={disableExport}
          className="rounded-md dark:bg-transparent"
          aria-label={t('Export activity')}
        >
          <DownloadIcon className="size-4" />
        </Button>
      )}
    />
  )
}
