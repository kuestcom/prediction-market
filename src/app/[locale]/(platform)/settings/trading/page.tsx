import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SettingsTradingContent from '@/app/[locale]/(platform)/settings/_components/SettingsTradingContent'
import { UserRepository } from '@/lib/db/queries/user'

export const metadata: Metadata = {
  title: 'Trading Settings',
}

export default async function TradingSettingsPage({ params }: PageProps<'/[locale]/settings/trading'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Market Order Type</h1>
        <p className="text-muted-foreground">
          Choose how your market orders are executed.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsTradingContent user={user} />
      </div>
    </section>
  )
}
