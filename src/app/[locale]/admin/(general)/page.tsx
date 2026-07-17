import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'
import AdminGeneralSettingsForm from '@/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { MARKET_CONTEXT_VARIABLES } from '@/lib/ai/market-context-template'
import { fetchOpenRouterModels } from '@/lib/ai/openrouter'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { HomeFeaturedEventsRepository } from '@/lib/db/queries/home-featured-events'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getBlockedCountriesFromSettings } from '@/lib/geoblock-settings'
import { getGlobalAnnouncementSettingsFromSettings } from '@/lib/global-announcement-settings'
import { getHomeFeaturedSettingsFromSettings } from '@/lib/home-featured-settings'
import { parseSportsSourceProviderSettings } from '@/lib/sports-source/settings'
import { getPublicAssetUrl } from '@/lib/storage'
import { getTermsOfServicePdfPath, getTermsOfServicePdfUrl } from '@/lib/terms-of-service'
import { getThemeSiteSettingsFormState } from '@/lib/theme-settings'
import { DEFAULT_THEME_SITE_PWA_ICON_192_URL, DEFAULT_THEME_SITE_PWA_ICON_512_URL } from '@/lib/theme-site-identity'

interface AdminGeneralSettingsPageProps {
  params: Promise<{ locale: string }>
}

function AdminGeneralSettingsFallback() {
  return <div className="min-h-96 rounded-lg border bg-background" />
}

async function AdminGeneralSettingsContent({ locale }: { locale: string }) {
  await io()
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()

  const parsedMarketContextSettings = parseMarketContextSettings(allSettings ?? undefined)
  const parsedSportsSourceSettings = parseSportsSourceProviderSettings(allSettings ?? undefined)
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
    catch {
      openRouterModelsError = t('Unable to load models from OpenRouter. Please try again later.')
    }
  }

  const initialThemeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const initialGlobalAnnouncement = getGlobalAnnouncementSettingsFromSettings(allSettings ?? undefined)
  const initialBlockedCountries = getBlockedCountriesFromSettings(allSettings ?? undefined)
  const initialThemeSiteImageUrl = initialThemeSiteSettings.logoMode === 'image'
    ? getPublicAssetUrl(initialThemeSiteSettings.logoImagePath || null)
    : null
  const initialPwaIcon192Url = getPublicAssetUrl(initialThemeSiteSettings.pwaIcon192Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_192_URL
  const initialPwaIcon512Url = getPublicAssetUrl(initialThemeSiteSettings.pwaIcon512Path || null)
    ?? DEFAULT_THEME_SITE_PWA_ICON_512_URL
  const initialTermsOfServicePdfPath = getTermsOfServicePdfPath(allSettings ?? undefined)
  const initialTermsOfServicePdfUrl = getTermsOfServicePdfUrl(allSettings ?? undefined) || null
  const initialHomeFeaturedSettings = getHomeFeaturedSettingsFromSettings(allSettings ?? undefined)
  initialHomeFeaturedSettings.sideCard.slides = initialHomeFeaturedSettings.sideCard.slides.map(slide => ({
    ...slide,
    imageUrl: getPublicAssetUrl(slide.imagePath || null) ?? '',
  }))
  const initialHomeFeaturedSideCardImageUrl = getPublicAssetUrl(initialHomeFeaturedSettings.sideCard.imagePath || null)
  const { data: initialHomeFeaturedEvents } = await HomeFeaturedEventsRepository.listAdminFeaturedEvents(locale)
  const initialThemeSiteSettingsWithImage: AdminThemeSiteSettingsInitialState = {
    ...initialThemeSiteSettings,
    logoImageUrl: initialThemeSiteImageUrl,
    pwaIcon192Url: initialPwaIcon192Url,
    pwaIcon512Url: initialPwaIcon512Url,
  }

  return (
    <AdminGeneralSettingsForm
      locale={locale}
      initialThemeSiteSettings={initialThemeSiteSettingsWithImage}
      initialGlobalAnnouncement={initialGlobalAnnouncement}
      initialBlockedCountries={initialBlockedCountries}
      initialTermsOfServicePdfPath={initialTermsOfServicePdfPath}
      initialTermsOfServicePdfUrl={initialTermsOfServicePdfUrl}
      initialMarketContextSettings={{
        enabled: parsedMarketContextSettings.enabled,
        prompt: parsedMarketContextSettings.prompt,
      }}
      initialArbitrageEnabled={isArbitrageEnabled(allSettings)}
      initialArbitrageMultiWalletEnabled={isArbitrageMultiWalletEnabled(allSettings)}
      marketContextVariables={MARKET_CONTEXT_VARIABLES}
      initialHomeFeaturedSettings={initialHomeFeaturedSettings}
      initialHomeFeaturedSideCardImageUrl={initialHomeFeaturedSideCardImageUrl}
      initialHomeFeaturedEvents={initialHomeFeaturedEvents ?? []}
      openRouterSettings={{
        defaultModel: defaultOpenRouterModel,
        isApiKeyConfigured: isOpenRouterApiKeyConfigured,
        isModelSelectEnabled: isOpenRouterModelSelectEnabled,
        modelOptions: openRouterModelOptions,
        modelsError: openRouterModelsError,
      }}
      sportsSourceSettings={{
        isPandaScoreTokenConfigured: Boolean(parsedSportsSourceSettings.pandascoreToken),
        isTheSportsDbApiKeyConfigured: Boolean(parsedSportsSourceSettings.theSportsDbApiKey),
      }}
    />
  )
}

export default async function AdminGeneralSettingsPage({ params }: AdminGeneralSettingsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return (
    <section className="grid max-w-full min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <h1 className="text-2xl font-semibold">{t('General Settings')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Configure company identity, analytics, support links, and AI provider settings.')}
        </p>
      </div>

      <Suspense fallback={<AdminGeneralSettingsFallback />}>
        <AdminGeneralSettingsContent locale={locale} />
      </Suspense>
    </section>
  )
}
