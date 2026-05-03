import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SettingsDeleteAccountContent from '@/app/[locale]/(platform)/settings/_components/SettingsDeleteAccountContent'
import SettingsTwoFactorAuthContent from '@/app/[locale]/(platform)/settings/_components/SettingsTwoFactorAuthContent'
import { UserRepository } from '@/lib/db/queries/user'

export async function generateMetadata({ params }: PageProps<'/[locale]/settings/account'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return {
    title: t('Account'),
  }
}

export default async function AccountSettingsPage({ params }: PageProps<'/[locale]/settings/account'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    notFound()
  }

  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Account')}</h1>
        <p className="text-muted-foreground">
          {t('Manage account security and deletion settings.')}
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-2xl gap-6 lg:mx-0">
        <section className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">{t('Two-Factor Authentication')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('Add an extra layer of security to your account.')}
            </p>
          </div>
          <SettingsTwoFactorAuthContent user={user} />
        </section>

        <SettingsDeleteAccountContent />
      </div>
    </section>
  )
}
