import { getExtracted, setRequestLocale } from 'next-intl/server'
import AdminEventsTable from '@/app/[locale]/admin/events/_components/AdminEventsTable'
import { loadAutoDeployNewEventsEnabled } from '@/lib/event-sync-settings'

export default async function AdminEventsPage({ params }: PageProps<'/[locale]/admin/events'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()
  const autoDeployNewEventsEnabled = await loadAutoDeployNewEventsEnabled()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Events')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage event visibility, inspect volume, and control how new synced events are deployed.')}
        </p>
      </div>
      <div className="min-w-0">
        <AdminEventsTable initialAutoDeployNewEventsEnabled={autoDeployNewEventsEnabled} />
      </div>
    </section>
  )
}
