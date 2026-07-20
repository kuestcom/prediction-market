import type { SupportedLocale } from '@/i18n/locales'
import type { AdminEventAttentionFilter } from '@/lib/db/queries/admin-event-attention'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import AdminEventsTable from '@/app/[locale]/admin/events/_components/AdminEventsTable'
import { isAdminEventAttentionFilter } from '@/lib/db/queries/admin-event-attention'
import { TagRepository } from '@/lib/db/queries/tag'
import { loadAutoDeployNewEventsEnabled } from '@/lib/event-sync-settings'
import { getConfiguredSportsSourceProviders } from '@/lib/sports-source/providers'
import { loadSportsSourceProviderSettings } from '@/lib/sports-source/settings'

function resolveSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function AdminEventsContent({
  locale,
  searchParams,
}: {
  locale: SupportedLocale
  searchParams: PageProps<'/[locale]/admin/events'>['searchParams']
}) {
  const resolvedSearchParams = await searchParams
  const attentionValue = resolveSearchParam(resolvedSearchParams?.attention)
  const initialAttention: AdminEventAttentionFilter | 'all' = isAdminEventAttentionFilter(attentionValue)
    ? attentionValue
    : 'all'
  const [autoDeployNewEventsEnabled, mainTagsResult, sportsSourceSettings] = await Promise.all([
    loadAutoDeployNewEventsEnabled(),
    TagRepository.getMainTags(locale),
    loadSportsSourceProviderSettings(),
  ])
  const mainCategoryOptions = (mainTagsResult.data ?? []).map(tag => ({
    slug: tag.slug,
    name: tag.name,
  }))

  return (
    <AdminEventsTable
      initialAutoDeployNewEventsEnabled={autoDeployNewEventsEnabled}
      initialAttention={initialAttention}
      mainCategoryOptions={mainCategoryOptions}
      configuredSportsSourceProviders={getConfiguredSportsSourceProviders(sportsSourceSettings)}
    />
  )
}

export default async function AdminEventsPage({ params, searchParams }: PageProps<'/[locale]/admin/events'>) {
  const { locale } = await params
  setRequestLocale(locale)
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
        <Suspense fallback={<div className="min-h-64 rounded-xl border bg-background" />}>
          <AdminEventsContent locale={locale as SupportedLocale} searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  )
}
