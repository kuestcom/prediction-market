import { getExtracted, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import AdminPageSkeleton from '@/app/[locale]/admin/_components/AdminPageSkeleton'
import AdminLocalesSettingsForm from '@/app/[locale]/admin/locales/_components/AdminLocalesSettingsForm'
import { getAutomaticTranslationsEnabledFromSettings, getEnabledLocalesFromSettings } from '@/i18n/locale-settings'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { parseOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { SettingsRepository } from '@/lib/db/queries/settings'

async function DynamicMarker() {
  await connection()
  return null
}

async function AdminLocalesSettingsContent({ params }: PageProps<'/[locale]/admin/locales'>) {
  'use cache'

  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()
  const enabledLocales = getEnabledLocalesFromSettings(allSettings ?? undefined)
  const automaticTranslationsEnabled = getAutomaticTranslationsEnabledFromSettings(allSettings ?? undefined)
  const openRouterSettings = parseOpenRouterProviderSettings(allSettings ?? undefined)
  const isOpenRouterConfigured = openRouterSettings.configured

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Locales')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage enabled locales and translation automation behavior.')}
        </p>
      </div>

      <AdminLocalesSettingsForm
        supportedLocales={SUPPORTED_LOCALES}
        enabledLocales={enabledLocales}
        automaticTranslationsEnabled={automaticTranslationsEnabled}
        isOpenRouterConfigured={isOpenRouterConfigured}
      />
    </section>
  )
}

export default function AdminLocalesSettingsPage(props: PageProps<'/[locale]/admin/locales'>) {
  return (
    <>
      <Suspense fallback={<AdminPageSkeleton />}>
        <AdminLocalesSettingsContent {...props} />
      </Suspense>
      <Suspense>
        <DynamicMarker />
      </Suspense>
    </>
  )
}
