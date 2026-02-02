import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SettingsProfileContent from '@/app/[locale]/(platform)/settings/_components/SettingsProfileContent'
import { UserRepository } from '@/lib/db/queries/user'

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function SettingsPage({ params }: PageProps<'/[locale]/settings'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account profile and preferences.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsProfileContent user={user} />
      </div>
    </section>
  )
}
