'use cache'

import { getExtracted, setRequestLocale } from 'next-intl/server'
import AdminLocalesSettingsForm from '@/app/[locale]/admin/locales/_components/AdminLocalesSettingsForm'
import { getEnabledLocalesFromSettings } from '@/i18n/locale-settings'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { SettingsRepository } from '@/lib/db/queries/settings'

export default async function AdminLocalesSettingsPage({ params }: PageProps<'/[locale]/admin/locales'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()
  const enabledLocales = getEnabledLocalesFromSettings(allSettings ?? undefined)

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Locales')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Set your OpenRouter credentials in General Settings to enable automatic event and category translations.')}
        </p>
      </div>

      <AdminLocalesSettingsForm
        supportedLocales={SUPPORTED_LOCALES}
        enabledLocales={enabledLocales}
      />
    </section>
  )
}
