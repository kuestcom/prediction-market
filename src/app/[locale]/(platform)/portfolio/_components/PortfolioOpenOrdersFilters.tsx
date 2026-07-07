import type { ReactNode } from 'react'
import type { PortfolioOpenOrdersSort } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { ArrowDownNarrowWideIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import SearchSortToolbar, { SearchSortSelect } from '@/app/[locale]/(platform)/_components/SearchSortToolbar'
import { SelectItem } from '@/components/ui/select'

interface PortfolioOpenOrdersFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  sortBy: PortfolioOpenOrdersSort
  onSortChange: (value: PortfolioOpenOrdersSort) => void
  action?: ReactNode
}

export default function PortfolioOpenOrdersFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  action,
}: PortfolioOpenOrdersFiltersProps) {
  const t = useExtracted()

  return (
    <SearchSortToolbar
      stackOnMobile
      searchQuery={searchQuery}
      searchPlaceholder={t('Search open orders...')}
      onSearchChange={onSearchChange}
      controls={(
        <SearchSortSelect
          value={sortBy}
          ariaLabel={t('Sort open orders')}
          icon={<ArrowDownNarrowWideIcon className="size-4 text-muted-foreground" />}
          onValueChange={value => onSortChange(value as PortfolioOpenOrdersSort)}
        >
          <SelectItem value="market">{t('Market')}</SelectItem>
          <SelectItem value="filled">{t('Filled Quantity')}</SelectItem>
          <SelectItem value="total">{t('Total Quantity')}</SelectItem>
          <SelectItem value="date">{t('Order Date')}</SelectItem>
          <SelectItem value="resolving">{t('Resolving Soonest')}</SelectItem>
        </SearchSortSelect>
      )}
      action={action}
    />
  )
}
