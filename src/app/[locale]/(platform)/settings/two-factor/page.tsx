import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import SettingsTwoFactorAuthContent from '@/app/[locale]/(platform)/settings/_components/SettingsTwoFactorAuthContent'
import { UserRepository } from '@/lib/db/queries/user'

export async function generateMetadata({ params }: PageProps<'/[locale]/settings/two-factor'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return {
    title: t('Two Factor Settings'),
  }
}

export default async function TwoFactorSettingsPage({ params }: PageProps<'/[locale]/settings/two-factor'>) {
  const { locale } = await params
  setRequestLocale(locale)

  await connection()

  const t = await getExtracted()

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Two-Factor Authentication')}</h1>
        <p className="text-muted-foreground">
          {t('Add an extra layer of security to your account.')}
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <SettingsTwoFactorAuthContent user={user} />
      </div>
    </section>
  )
}
