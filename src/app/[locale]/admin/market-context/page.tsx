'use cache'

import { getExtracted, setRequestLocale } from 'next-intl/server'
import AdminMarketContextSettingsForm from '@/app/[locale]/admin/market-context/_components/AdminMarketContextSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { MARKET_CONTEXT_VARIABLES } from '@/lib/ai/market-context-template'
import { SettingsRepository } from '@/lib/db/queries/settings'

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  const { data: allSettings } = await SettingsRepository.getSettings()
  const parsedSettings = parseMarketContextSettings(allSettings ?? undefined)
  const defaultPrompt = parsedSettings.prompt
  const isEnabled = parsedSettings.enabled

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Market Context')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('OpenRouter is required, the credentials and model selection are in General Settings.')}
        </p>
      </div>

      <AdminMarketContextSettingsForm
        defaultPrompt={defaultPrompt}
        isEnabled={isEnabled}
        variables={MARKET_CONTEXT_VARIABLES}
      />
    </section>
  )
}
