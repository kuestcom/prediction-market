'use client'

import BiggestWinsSidebar from '@/app/[locale]/(platform)/leaderboard/_components/BiggestWinsSidebar'
import LeaderboardFiltersBar from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardFiltersBar'
import LeaderboardPagination from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardPagination'
import { LeaderboardListSkeleton } from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardSkeletons'
import {
  CATEGORY_OPTIONS,
  DEFAULT_FILTERS,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import {
  LEADERBOARD_LAYOUT_CLASS_NAME,
  LEADERBOARD_ROW_CLASS_NAME,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardStyles'

const DEFAULT_CATEGORY_LABEL = CATEGORY_OPTIONS.find(option => option.value === DEFAULT_FILTERS.category)?.label
  ?? 'All Categories'

function ignoreSkeletonInteraction() {}

export default function LeaderboardPageSkeleton() {
  return (
    <div className="relative w-full" aria-busy="true">
      <div className={LEADERBOARD_LAYOUT_CLASS_NAME}>
        <section className="flex min-w-0 flex-col gap-6">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Leaderboard</h1>

          <div className="flex min-w-0 flex-col">
            <LeaderboardFiltersBar
              filters={DEFAULT_FILTERS}
              categoryLabel={DEFAULT_CATEGORY_LABEL}
              searchInput=""
              onSearchInputChange={ignoreSkeletonInteraction}
              onUpdateFilters={ignoreSkeletonInteraction}
            />
            <div className="divide-y divide-border/80">
              <LeaderboardListSkeleton count={10} rowClassName={LEADERBOARD_ROW_CLASS_NAME} />
            </div>
            <LeaderboardPagination page={1} setPageValue={ignoreSkeletonInteraction} />
          </div>
        </section>

        <BiggestWinsSidebar
          biggestWins={[]}
          isBiggestWinsLoading
          biggestWinsPeriodLabel="this month"
        />
      </div>
    </div>
  )
}
