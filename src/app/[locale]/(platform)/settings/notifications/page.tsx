import type { Metadata } from 'next'

import { getExtracted } from 'next-intl/server'
import { notFound } from 'next/navigation'

import SettingsNotificationsContent from '@/app/[locale]/(platform)/settings/_components/SettingsNotificationsContent'
import { UserRepository } from '@/lib/db/queries/user'

export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted()

  return {
    title: t('Notification Settings'),
  }
}

export default async function NotificationsSettingsPage() {
  const t = await getExtracted()

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Notifications')}</h1>
        <p className="text-muted-foreground">{t('Configure how you receive notifications.')}</p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsNotificationsContent user={user} />
      </div>
    </section>
  )
}
