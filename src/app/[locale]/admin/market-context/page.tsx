import { getExtracted, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import AdminMarketContextSettingsForm from '@/app/[locale]/admin/market-context/_components/AdminMarketContextSettingsForm'
import { parseMarketContextSettings } from '@/lib/ai/market-context-config'
import { MARKET_CONTEXT_VARIABLES } from '@/lib/ai/market-context-template'
import { SettingsRepository } from '@/lib/db/queries/settings'

function AdminMarketContextSettingsFallback() {
  return <div className="min-h-96 rounded-lg border bg-background" />
}

async function AdminMarketContextSettingsContent() {
  await connection()
  const { data: allSettings } = await SettingsRepository.getSettings()
  const parsedSettings = parseMarketContextSettings(allSettings ?? undefined)
  const defaultPrompt = parsedSettings.prompt
  const isEnabled = parsedSettings.enabled

  return (
    <AdminMarketContextSettingsForm
      defaultPrompt={defaultPrompt}
      isEnabled={isEnabled}
      variables={MARKET_CONTEXT_VARIABLES}
    />
  )
}

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t('Market Context')}</h1>

      <Suspense fallback={<AdminMarketContextSettingsFallback />}>
        <AdminMarketContextSettingsContent />
      </Suspense>
    </section>
  )
}
