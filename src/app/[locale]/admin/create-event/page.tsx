import { setRequestLocale } from 'next-intl/server'
import AdminCreateEventForm from '@/app/[locale]/admin/create-event/_components/AdminCreateEventForm'
import { buildAdminSportsSlugCatalog, EMPTY_ADMIN_SPORTS_SLUG_CATALOG } from '@/lib/admin-sports-slugs'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export default async function AdminCreateEventPage({ params }: PageProps<'/[locale]/admin/create-event'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const sportsMenuResult = await SportsMenuRepository.getMenuEntries()
  const sportsSlugCatalog = sportsMenuResult.data
    ? buildAdminSportsSlugCatalog(sportsMenuResult.data)
    : EMPTY_ADMIN_SPORTS_SLUG_CATALOG

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Create Event</h1>
        <p className="text-sm text-muted-foreground">Create events and markets with a guided flow.</p>
      </div>
      <div className="min-w-0">
        <AdminCreateEventForm sportsSlugCatalog={sportsSlugCatalog} />
      </div>
    </section>
  )
}
