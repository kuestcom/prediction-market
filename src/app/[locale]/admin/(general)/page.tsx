'use cache'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { setRequestLocale } from 'next-intl/server'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { fetchOpenRouterModels } from '@/lib/ai/openrouter'
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
      openRouterModelsError = 'Unable to load models from OpenRouter. Please try again later.'
    }
  }

  if (defaultOpenRouterModel && !openRouterModelOptions.some(option => option.id === defaultOpenRouterModel)) {
    openRouterModelOptions = [{ id: defaultOpenRouterModel, label: defaultOpenRouterModel }, ...openRouterModelOptions]
  }

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
          Configure company identity, analytics, support links, and AI provider settings.
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
