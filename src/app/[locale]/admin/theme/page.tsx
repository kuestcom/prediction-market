'use cache'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import AdminThemeSettingsForm from '@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'
import { getThemePresetOptions } from '@/lib/theme'
import { getThemeSettingsFormState, getThemeSiteSettingsFormState } from '@/lib/theme-settings'

export default async function AdminThemeSettingsPage({ params }: PageProps<'/[locale]/admin/theme'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()

  const initialThemeSettings = getThemeSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getSupabasePublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const initialThemeSiteSettingsWithImage: AdminThemeSiteSettingsInitialState = {
    ...initialThemeSiteSettings,
    logoImageUrl: initialThemeSiteImageUrl,
  }
  const presetOptions = getThemePresetOptions()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Theme')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Configure colors and corner style.')}
        </p>
      </div>

      <AdminThemeSettingsForm
        presetOptions={presetOptions}
        initialThemeSettings={initialThemeSettings}
        initialThemeSiteSettings={initialThemeSiteSettingsWithImage}
      />
    </section>
  )
}
