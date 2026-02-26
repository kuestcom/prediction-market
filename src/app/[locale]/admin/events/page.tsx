import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import AdminEventsTable from '@/app/[locale]/admin/events/_components/AdminEventsTable'
import { TagRepository } from '@/lib/db/queries/tag'
import { loadAutoDeployNewEventsEnabled } from '@/lib/event-sync-settings'

export default async function AdminEventsPage({ params }: PageProps<'/[locale]/admin/events'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  const t = await getExtracted()
  const [autoDeployNewEventsEnabled, mainTagsResult] = await Promise.all([
    loadAutoDeployNewEventsEnabled(),
    TagRepository.getMainTags(resolvedLocale),
  ])
  const mainCategoryOptions = (mainTagsResult.data ?? []).map(tag => ({
    slug: tag.slug,
    name: tag.name,
  }))

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Events')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage event visibility, inspect volume, and control how new synced events are deployed.')}
        </p>
      </div>
      <div className="min-w-0">
        <Suspense fallback={(
          <div className="overflow-hidden rounded-md border">
            <div className="space-y-3 p-4">
              <div className="h-8 w-80 animate-pulse rounded-md bg-muted/60" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted/50" />
            </div>
          </div>
        )}
        >
          <AdminEventsTable
            initialAutoDeployNewEventsEnabled={autoDeployNewEventsEnabled}
            mainCategoryOptions={mainCategoryOptions}
          />
        </Suspense>
      </div>
    </section>
  )
}
