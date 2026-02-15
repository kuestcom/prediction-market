'use cache'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { fetchOpenRouterModels } from '@/lib/ai/openrouter'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'
import { getThemeSiteSettingsFormState } from '@/lib/theme-settings'
import { DEFAULT_THEME_SITE_PWA_ICON_192_URL, DEFAULT_THEME_SITE_PWA_ICON_512_URL } from '@/lib/theme-site-identity'

interface AdminGeneralSettingsPageProps {
  params: Promise<{ locale: string }>
}

export default async function AdminGeneralSettingsPage({ params }: AdminGeneralSettingsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()

  const parsedMarketContextSettings = parseMarketContextSettings(allSettings ?? undefined)
  const defaultOpenRouterModel = parsedMarketContextSettings.model ?? ''
  const apiKeyForModels = parsedMarketContextSettings.apiKey
  const isOpenRouterApiKeyConfigured = Boolean(apiKeyForModels)
  const isOpenRouterModelSelectEnabled = isOpenRouterApiKeyConfigured

  let openRouterModelsError: string | undefined
  let openRouterModelOptions: Array<{ id: string, label: string, contextWindow?: number }> = []

  if (isOpenRouterModelSelectEnabled && apiKeyForModels) {
    try {
      const models = await fetchOpenRouterModels(apiKeyForModels)
      openRouterModelOptions = models.map(model => ({
        id: model.id,
        label: model.name,
        contextWindow: model.contextLength,
      }))
    }
    catch (error) {
      console.error('Failed to load OpenRouter models', error)
      openRouterModelsError = t('Unable to load models from OpenRouter. Please try again later.')
    }
  }

  if (defaultOpenRouterModel && !openRouterModelOptions.some(option => option.id === defaultOpenRouterModel)) {
    openRouterModelOptions = [{ id: defaultOpenRouterModel, label: defaultOpenRouterModel }, ...openRouterModelOptions]
  }

  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getSupabasePublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const initialPwaIcon192Url = getSupabasePublicAssetUrl(initialThemeSiteSettings.pwaIcon192Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_192_URL
  const initialPwaIcon512Url = getSupabasePublicAssetUrl(initialThemeSiteSettings.pwaIcon512Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_512_URL
  const initialThemeSiteSettingsWithImage: AdminThemeSiteSettingsInitialState = {
    ...initialThemeSiteSettings,
    logoImageUrl: initialThemeSiteImageUrl,
    pwaIcon192Url: initialPwaIcon192Url,
    pwaIcon512Url: initialPwaIcon512Url,
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('General Settings')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Configure company identity, analytics, support links, and AI provider settings.')}
        </p>
      </div>

      <AdminGeneralSettingsForm
        initialThemeSiteSettings={initialThemeSiteSettingsWithImage}
        openRouterSettings={{
          defaultModel: defaultOpenRouterModel,
          isApiKeyConfigured: isOpenRouterApiKeyConfigured,
          isModelSelectEnabled: isOpenRouterModelSelectEnabled,
          modelOptions: openRouterModelOptions,
          modelsError: openRouterModelsError,
        }}
      />
    </section>
  )
}
