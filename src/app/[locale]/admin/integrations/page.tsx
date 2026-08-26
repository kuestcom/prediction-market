import { getExtracted, setRequestLocale } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'

import { AdminAccordionSkeleton } from '@/app/[locale]/admin/_components/AdminPageSkeleton'
import AdminIntegrationsForm from '@/app/[locale]/admin/integrations/_components/AdminIntegrationsForm'
import { getRootLocale } from '@/i18n/root-locale'
import { getKuestSupportSettings } from '@/lib/admin-support-settings'
import { parseOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { fetchAllOpenRouterModels, fetchOpenRouterModels } from '@/lib/ai/openrouter'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { parseSportsSourceProviderSettings } from '@/lib/sports-source/settings'
import { parseSumsubSettings, sanitizeSumsubSettings } from '@/lib/sumsub/settings'
import { getThemeSiteSettingsFormState } from '@/lib/theme-settings'

export const instant = false

function AdminIntegrationsFallback() {
  return <AdminAccordionSkeleton itemCount={9} showDescription />
}

async function AdminIntegrationsContent() {
  await io()
  const locale = await getRootLocale()
  const t = await getExtracted()
  const { data: allSettings } = await SettingsRepository.getSettings()
  const themeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const openRouterSettings = parseOpenRouterProviderSettings(allSettings ?? undefined)
  const sportsSourceSettings = parseSportsSourceProviderSettings(allSettings ?? undefined)
  const parsedSumsubSettings = parseSumsubSettings(allSettings ?? undefined)

  let modelOptions: Array<{ id: string; label: string; contextWindow?: number }> = []
  let translationModelOptions: Array<{ id: string; label: string; contextWindow?: number }> = []
  let modelsError: string | undefined
  let translationModelsError: string | undefined
  if (openRouterSettings.apiKey) {
    const [modelsResult, translationModelsResult] = await Promise.allSettled([
      fetchOpenRouterModels(openRouterSettings.apiKey),
      fetchAllOpenRouterModels(openRouterSettings.apiKey),
    ])

    if (modelsResult.status === 'fulfilled') {
      modelOptions = modelsResult.value.map((model) => ({
        id: model.id,
        label: model.name,
        contextWindow: model.contextLength,
      }))
    } else {
      modelsError = t('Unable to load models from OpenRouter. Please try again later.')
    }

    if (translationModelsResult.status === 'fulfilled') {
      translationModelOptions = translationModelsResult.value.map((model) => ({
        id: model.id,
        label: model.name,
        contextWindow: model.contextLength,
      }))
    } else {
      translationModelsError = t('Unable to load models from OpenRouter. Please try again later.')
    }
  }

  return (
    <AdminIntegrationsForm
      locale={locale}
      googleAnalyticsId={themeSiteSettings.googleAnalyticsId}
      customJavascriptCodes={themeSiteSettings.customJavascriptCodes}
      lifiIntegrator={themeSiteSettings.lifiIntegrator}
      lifiApiKeyConfigured={themeSiteSettings.lifiApiKeyConfigured}
      kuestSupportSettings={getKuestSupportSettings(allSettings)}
      openRouterSettings={{
        defaultModel: openRouterSettings.model,
        translationModel: openRouterSettings.translationModel,
        isApiKeyConfigured: Boolean(openRouterSettings.apiKey),
        modelOptions,
        translationModelOptions,
        modelsError,
        translationModelsError,
      }}
      sportsSourceSettings={{
        isPandaScoreTokenConfigured: Boolean(sportsSourceSettings.pandascoreToken),
        isTheSportsDbApiKeyConfigured: Boolean(sportsSourceSettings.theSportsDbApiKey),
      }}
      arbitrageSettings={{
        enabled: isArbitrageEnabled(allSettings),
        multiWalletEnabled: isArbitrageMultiWalletEnabled(allSettings),
      }}
      sumsubSettings={{
        ...sanitizeSumsubSettings(parsedSumsubSettings),
        appTokenConfigured: Boolean(parsedSumsubSettings.appToken),
        secretKeyConfigured: Boolean(parsedSumsubSettings.secretKey),
        webhookSecretConfigured: Boolean(parsedSumsubSettings.webhookSecret),
      }}
    />
  )
}

export default async function AdminIntegrationsPage() {
  setRequestLocale(await getRootLocale())
  const t = await getExtracted()

  return (
    <section className="grid max-w-full min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <h1 className="text-2xl font-semibold">{t('Integrations')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Connect analytics, AI, identity, sports data, liquidity, and custom tools.')}
        </p>
      </div>
      <Suspense fallback={<AdminIntegrationsFallback />}>
        <AdminIntegrationsContent />
      </Suspense>
    </section>
  )
}
