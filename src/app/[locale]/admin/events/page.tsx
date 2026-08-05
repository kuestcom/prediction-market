import { getExtracted, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'

import { DataTableSkeleton } from '@/app/[locale]/admin/_components/DataTableSkeleton'
import AdminEventsTableFromUrl from '@/app/[locale]/admin/events/_components/AdminEventsTableFromUrl'
import { getRootLocale } from '@/i18n/root-locale'
import { TagRepository } from '@/lib/db/queries/tag'
import { loadAutoDeployNewEventsEnabled } from '@/lib/event-sync-settings'

export const instant = false

async function AdminEventsContent() {
  const locale = await getRootLocale()
  const [autoDeployNewEventsEnabled, mainTagsResult] = await Promise.all([
    loadAutoDeployNewEventsEnabled(),
    TagRepository.getMainTags(locale),
  ])
  const mainCategoryOptions = (mainTagsResult.data ?? []).map((tag) => ({
    slug: tag.slug,
    name: tag.name,
  }))

  return (
    <AdminEventsTableFromUrl
      initialAutoDeployNewEventsEnabled={autoDeployNewEventsEnabled}
      mainCategoryOptions={mainCategoryOptions}
    />
  )
}

export default async function AdminEventsPage() {
  setRequestLocale(await getRootLocale())
  const t = await getExtracted()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Events')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage event visibility, inspect volume, and control how new synced events are deployed.')}
        </p>
      </div>
      <div className="min-w-0">
        <Suspense fallback={<DataTableSkeleton columnCount={6} rowCount={8} />}>
          <AdminEventsContent />
        </Suspense>
      </div>
    </section>
  )
}
