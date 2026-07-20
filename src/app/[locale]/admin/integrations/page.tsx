import { getExtracted, setRequestLocale } from 'next-intl/server'
import { io } from 'next/cache'
import { Suspense } from 'react'
import AdminIntegrationsForm from '@/app/[locale]/admin/integrations/_components/AdminIntegrationsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { fetchOpenRouterModels } from '@/lib/ai/openrouter'
import { isArbitrageEnabled, isArbitrageMultiWalletEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { parseSportsSourceProviderSettings } from '@/lib/sports-source/settings'
import { parseSumsubSettings, sanitizeSumsubSettings } from '@/lib/sumsub/settings'
import { getThemeSiteSettingsFormState } from '@/lib/theme-settings'

function AdminIntegrationsFallback() {
  return <div className="min-h-96 rounded-lg border bg-background" />
}

async function AdminIntegrationsContent({ locale }: { locale: string }) {
  await io()
  const t = await getExtracted()
  const { data: allSettings } = await SettingsRepository.getSettings()
  const themeSiteSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
  const openRouterSettings = parseMarketContextSettings(allSettings ?? undefined)
  const sportsSourceSettings = parseSportsSourceProviderSettings(allSettings ?? undefined)
  const parsedSumsubSettings = parseSumsubSettings(allSettings ?? undefined)

  let modelOptions: Array<{ id: string, label: string, contextWindow?: number }> = []
  let modelsError: string | undefined
  if (openRouterSettings.apiKey) {
    try {
      const models = await fetchOpenRouterModels(openRouterSettings.apiKey)
      modelOptions = models.map(model => ({
        id: model.id,
        label: model.name,
        contextWindow: model.contextLength,
      }))
    }
    catch {
      modelsError = t('Unable to load models from OpenRouter. Please try again later.')
    }
  }

  return (
    <AdminIntegrationsForm
      locale={locale}
      googleAnalyticsId={themeSiteSettings.googleAnalyticsId}
      customJavascriptCodes={themeSiteSettings.customJavascriptCodes}
      lifiIntegrator={themeSiteSettings.lifiIntegrator}
      lifiApiKeyConfigured={themeSiteSettings.lifiApiKeyConfigured}
      openRouterSettings={{
        defaultModel: openRouterSettings.model,
        isApiKeyConfigured: Boolean(openRouterSettings.apiKey),
        modelOptions,
        modelsError,
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

export default async function AdminIntegrationsPage({ params }: PageProps<'/[locale]/admin/integrations'>) {
  const { locale } = await params
  setRequestLocale(locale)
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
        <AdminIntegrationsContent locale={locale} />
      </Suspense>
    </section>
  )
}
