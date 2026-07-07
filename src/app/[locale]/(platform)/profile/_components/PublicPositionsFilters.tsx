import type { SortOption } from '@/app/[locale]/(platform)/profile/_types/PublicPositionsTypes'
import { ArrowDownNarrowWideIcon, MergeIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import SearchSortToolbar, { SearchSortSelect } from '@/app/[locale]/(platform)/_components/SearchSortToolbar'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PublicPositionsFiltersProps {
  searchQuery: string
  sortBy: SortOption
  onSearchChange: (query: string) => void
  onSortChange: (value: SortOption) => void
  showMergeButton: boolean
  onMergeClick: () => void
}

export default function PublicPositionsFilters({
  searchQuery,
  sortBy,
  onSearchChange,
  onSortChange,
  showMergeButton,
  onMergeClick,
}: PublicPositionsFiltersProps) {
  const t = useExtracted()

  return (
    <SearchSortToolbar
      searchQuery={searchQuery}
      searchPlaceholder={t('Search markets...')}
      onSearchChange={onSearchChange}
      controls={(
        <SearchSortSelect
          value={sortBy}
          ariaLabel={t('Sort positions')}
          icon={<ArrowDownNarrowWideIcon className="size-4 text-muted-foreground" />}
          onValueChange={value => onSortChange(value as SortOption)}
        >
          <SelectItem value="currentValue">{t('Current value')}</SelectItem>
          <SelectItem value="trade">{t('Trade')}</SelectItem>
          <SelectItem value="pnlPercent">{t('Profit & Loss %')}</SelectItem>
          <SelectItem value="pnlValue">{t('Profit & Loss $')}</SelectItem>
          <SelectItem value="shares">{t('Shares')}</SelectItem>
          <SelectItem value="alpha">{t('Alphabetically')}</SelectItem>
          <SelectItem value="endingSoon">{t('Ending soon')}</SelectItem>
          <SelectItem value="payout">{t('Payout')}</SelectItem>
          <SelectItem value="latestPrice">{t('Latest Price')}</SelectItem>
          <SelectItem value="avgCost">{t('Average cost per share')}</SelectItem>
        </SearchSortSelect>
      )}
      action={showMergeButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-md dark:bg-transparent"
              onClick={onMergeClick}
              aria-label={t('Merge positions')}
            >
              <MergeIcon className="size-4 rotate-90" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Merge')}</TooltipContent>
        </Tooltip>
      )}
    />
  )
}
