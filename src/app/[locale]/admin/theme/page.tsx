'use cache'

import { setRequestLocale } from 'next-intl/server'
import AdminThemeSettingsForm from '@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getThemePresetOptions } from '@/lib/theme'
import { getThemeSettingsFormState } from '@/lib/theme-settings'

export default async function AdminThemeSettingsPage({ params }: PageProps<'/[locale]/admin/theme'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const { data: allSettings } = await SettingsRepository.getSettings()

  const initialThemeSettings = getThemeSettingsFormState(allSettings ?? undefined)
  const presetOptions = getThemePresetOptions()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Theme</h1>
        <p className="text-sm text-muted-foreground">
          Select theme presets and colors.
        </p>
      </div>

      <AdminThemeSettingsForm
        presetOptions={presetOptions}
        initialPreset={initialThemeSettings.preset}
        initialRadius={initialThemeSettings.radius}
        initialLightJson={initialThemeSettings.lightJson}
        initialDarkJson={initialThemeSettings.darkJson}
      />
    </section>
  )
}
