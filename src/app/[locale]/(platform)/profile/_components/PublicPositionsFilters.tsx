import { ArrowDownNarrowWideIcon, MergeIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { MarketStatusFilter, SortOption } from '@/app/[locale]/(platform)/profile/_types/PublicPositionsTypes'

import SearchSortToolbar, { SearchSortSelect } from '@/app/[locale]/(platform)/_components/SearchSortToolbar'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PublicPositionsFiltersProps {
  searchQuery: string
  sortBy: SortOption
  marketStatusFilter: MarketStatusFilter
  onSearchChange: (query: string) => void
  onSortChange: (value: SortOption) => void
  onMarketStatusChange: (value: MarketStatusFilter) => void
  showMergeButton: boolean
  onMergeClick: () => void
}

export default function PublicPositionsFilters({
  searchQuery,
  sortBy,
  marketStatusFilter,
  onSearchChange,
  onSortChange,
  onMarketStatusChange,
  showMergeButton,
  onMergeClick,
}: PublicPositionsFiltersProps) {
  const t = useExtracted()

  return (
    <SearchSortToolbar
      searchQuery={searchQuery}
      searchPlaceholder={t('Search markets...')}
      onSearchChange={onSearchChange}
      controls={
        <>
          <div
            role="group"
            aria-label={t('Positions')}
            className="flex shrink-0 items-center rounded-md bg-muted p-0.5"
          >
            {(['active', 'closed'] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={marketStatusFilter === status}
                className={cn(
                  'h-8 rounded-sm px-2.5 text-xs shadow-none sm:px-3 sm:text-sm',
                  marketStatusFilter === status
                    ? 'bg-background text-foreground shadow-xs hover:bg-background'
                    : 'text-muted-foreground',
                )}
                onClick={() => onMarketStatusChange(status)}
              >
                {status === 'active' ? t('Active') : t('Closed')}
              </Button>
            ))}
          </div>

          <SearchSortSelect
            items={[
              {
                label: marketStatusFilter === 'closed' ? t('Amount Won') : t('Current value'),
                value: 'currentValue',
              },
              { label: t('Trade'), value: 'trade' },
              { label: t('Profit & Loss %'), value: 'pnlPercent' },
              { label: t('Profit & Loss $'), value: 'pnlValue' },
              { label: t('Shares'), value: 'shares' },
              { label: t('Alphabetically'), value: 'alpha' },
              { label: t('Ending soon'), value: 'endingSoon' },
              { label: t('Payout'), value: 'payout' },
              { label: t('Latest Price'), value: 'latestPrice' },
              { label: t('Average cost per share'), value: 'avgCost' },
            ]}
            value={sortBy}
            ariaLabel={t('Sort positions')}
            icon={<ArrowDownNarrowWideIcon className="size-4 text-muted-foreground" />}
            onValueChange={(value) => onSortChange(value as SortOption)}
          >
            <SelectItem value="currentValue">
              {marketStatusFilter === 'closed' ? t('Amount Won') : t('Current value')}
            </SelectItem>
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
        </>
      }
      action={
        showMergeButton && (
          <Tooltip>
            <TooltipTrigger
              render={
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
              }
            />
            <TooltipContent>{t('Merge')}</TooltipContent>
          </Tooltip>
        )
      }
    />
  )
}
