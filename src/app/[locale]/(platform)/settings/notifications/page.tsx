import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SettingsNotificationsContent from '@/app/[locale]/(platform)/settings/_components/SettingsNotificationsContent'
import { UserRepository } from '@/lib/db/queries/user'

export const metadata: Metadata = {
  title: 'Notification Settings',
}

export default async function NotificationsSettingsPage({ params }: PageProps<'/[locale]/settings/notifications'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Configure how you receive notifications.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsNotificationsContent user={user} />
      </div>
    </section>
  )
}
