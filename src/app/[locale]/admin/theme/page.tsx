'use cache'

import { setRequestLocale } from 'next-intl/server'
import AdminThemeSettingsForm from '@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm'
import AdminThemeSiteSettingsForm from '@/app/[locale]/admin/theme/_components/AdminThemeSiteSettingsForm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'
import { getThemePresetOptions } from '@/lib/theme'
import { getThemeSettingsFormState, getThemeSiteSettingsFormState } from '@/lib/theme-settings'

export default async function AdminThemeSettingsPage({ params }: PageProps<'/[locale]/admin/theme'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const { data: allSettings } = await SettingsRepository.getSettings()

  const initialThemeSettings = getThemeSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getSupabasePublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const presetOptions = getThemePresetOptions()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Theme</h1>
        <p className="text-sm text-muted-foreground">
          Configure brand identity, colors, and radius.
        </p>
      </div>

      <AdminThemeSiteSettingsForm
        initialSiteName={initialThemeSiteSettings.siteName}
        initialSiteDescription={initialThemeSiteSettings.siteDescription}
        initialLogoMode={initialThemeSiteSettings.logoMode}
        initialLogoSvg={initialThemeSiteSettings.logoSvg}
        initialLogoImagePath={initialThemeSiteSettings.logoImagePath}
        initialLogoImageUrl={initialThemeSiteImageUrl}
      />

      <AdminThemeSettingsForm
        presetOptions={presetOptions}
        initialPreset={initialThemeSettings.preset}
        initialRadius={initialThemeSettings.radius}
        initialLightJson={initialThemeSettings.lightJson}
        initialDarkJson={initialThemeSettings.darkJson}
        siteName={initialThemeSiteSettings.siteName}
        logoSvg={initialThemeSiteSettings.logoSvg}
        logoImageUrl={initialThemeSiteImageUrl}
      />
    </section>
  )
}
