import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import LeaderboardClient from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardClient'
import { parseLeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Leaderboard',
}

export default async function LeaderboardPage({ params }: PageProps<'/[locale]/leaderboard/[[...filters]]'>) {
  const { locale, filters } = await params
  setRequestLocale(locale)

  const initialFilters = parseLeaderboardFilters(filters)

  return (
    <main className="container w-full py-6 md:py-8">
      <LeaderboardClient initialFilters={initialFilters} />
    </main>
  )
}
