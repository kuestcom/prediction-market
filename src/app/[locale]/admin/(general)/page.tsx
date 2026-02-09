'use cache'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { setRequestLocale } from 'next-intl/server'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'
import { getThemeSiteSettingsFormState } from '@/lib/theme-settings'

interface AdminGeneralSettingsPageProps {
  params: Promise<{ locale: string }>
}

export default async function AdminGeneralSettingsPage({ params }: AdminGeneralSettingsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  const { data: allSettings } = await SettingsRepository.getSettings()
  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getSupabasePublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const initialThemeSiteSettingsWithImage: AdminThemeSiteSettingsInitialState = {
    ...initialThemeSiteSettings,
    logoImageUrl: initialThemeSiteImageUrl,
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">General Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure company identity, analytics, and support links.
        </p>
      </div>

      <AdminGeneralSettingsForm initialThemeSiteSettings={initialThemeSiteSettingsWithImage} />
    </section>
  )
}
