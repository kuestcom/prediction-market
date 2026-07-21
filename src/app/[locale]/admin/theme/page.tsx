import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'
import { AdminSettingsSkeleton } from '@/app/[locale]/admin/_components/AdminPageSkeleton'
import AdminThemeSettingsForm from '@/app/[locale]/admin/theme/_components/AdminThemeSettingsForm'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getPublicAssetUrl } from '@/lib/storage'
import { getThemePresetOptions } from '@/lib/theme'
import { getThemeSettingsFormState, getThemeSiteSettingsFormState } from '@/lib/theme-settings'
import { DEFAULT_THEME_SITE_PWA_ICON_192_URL, DEFAULT_THEME_SITE_PWA_ICON_512_URL } from '@/lib/theme-site-identity'

function AdminThemeSettingsFallback() {
  return <AdminSettingsSkeleton sectionCount={3} />
}

async function AdminThemeSettingsContent() {
  await io()
  const { data: allSettings } = await SettingsRepository.getSettings()

  const initialThemeSettings = getThemeSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getPublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const initialPwaIcon192Url = getPublicAssetUrl(initialThemeSiteSettings.pwaIcon192Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_192_URL
  const initialPwaIcon512Url = getPublicAssetUrl(initialThemeSiteSettings.pwaIcon512Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_512_URL
  const initialThemeSiteSettingsWithImage: AdminThemeSiteSettingsInitialState = {
    ...initialThemeSiteSettings,
    logoImageUrl: initialThemeSiteImageUrl,
    pwaIcon192Url: initialPwaIcon192Url,
    pwaIcon512Url: initialPwaIcon512Url,
  }
  const presetOptions = getThemePresetOptions()

  return (
    <AdminThemeSettingsForm
      presetOptions={presetOptions}
      initialThemeSettings={initialThemeSettings}
      initialThemeSiteSettings={initialThemeSiteSettingsWithImage}
    />
  )
}

export default async function AdminThemeSettingsPage({ params }: PageProps<'/[locale]/admin/theme'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Theme')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Configure colors and corner style.')}
        </p>
      </div>

      <Suspense fallback={<AdminThemeSettingsFallback />}>
        <AdminThemeSettingsContent />
      </Suspense>
    </section>
  )
}
