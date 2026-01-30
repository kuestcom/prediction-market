'use cache'

import { setRequestLocale } from 'next-intl/server'
import AdminMarketContextSettingsForm from '@/app/[locale]/admin/market-context/_components/AdminMarketContextSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { MARKET_CONTEXT_VARIABLES } from '@/lib/ai/market-context-template'
import { fetchOpenRouterModels } from '@/lib/ai/openrouter'
import { SettingsRepository } from '@/lib/db/queries/settings'

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const { data: allSettings } = await SettingsRepository.getSettings()
  const parsedSettings = parseMarketContextSettings(allSettings ?? undefined)
  const defaultPrompt = parsedSettings.prompt
  const defaultModel = parsedSettings.model ?? ''
  const isEnabled = parsedSettings.enabled
  const apiKeyForModels = parsedSettings.apiKey
  const isModelSelectEnabled = Boolean(apiKeyForModels)

  let modelsError: string | undefined
  let modelOptions: Array<{ id: string, label: string, contextWindow?: number }> = []

  if (isModelSelectEnabled && apiKeyForModels) {
    try {
      const models = await fetchOpenRouterModels(apiKeyForModels)
      modelOptions = models.map(model => ({
        id: model.id,
        label: model.name,
        contextWindow: model.contextLength,
      }))
    }
    catch (error) {
      console.error('Failed to load OpenRouter models', error)
      modelsError = 'Unable to load models from OpenRouter. Please try again later.'
    }
  }

  if (defaultModel && !modelOptions.some(option => option.id === defaultModel)) {
    modelOptions = [{ id: defaultModel, label: defaultModel }, ...modelOptions]
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Market context</h1>
        <p className="text-sm text-muted-foreground">
          Control the AI prompt, OpenRouter credentials, and model selection for market context generation.
        </p>
      </div>

      <AdminMarketContextSettingsForm
        defaultPrompt={defaultPrompt}
        variables={MARKET_CONTEXT_VARIABLES}
        models={modelOptions}
        defaultModel={defaultModel}
        isEnabled={isEnabled}
        isModelSelectEnabled={isModelSelectEnabled}
        modelsError={modelsError}
      />
    </section>
  )
}
