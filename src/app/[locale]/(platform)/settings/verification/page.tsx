import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SettingsIdentityVerificationContent from '@/app/[locale]/(platform)/settings/_components/SettingsIdentityVerificationContent'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { parseIdentitySettings } from '@/lib/identity/settings'

interface IdentityVerificationPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: IdentityVerificationPageProps): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()
  return { title: t('Identity verification') }
}

export default async function IdentityVerificationPage({ params }: IdentityVerificationPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()
  const [user, settingsResult] = await Promise.all([
    UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true }),
    SettingsRepository.getSettings(),
  ])
  if (!user) {
    notFound()
  }
  const identityEnabled = parseIdentitySettings(settingsResult.data).enabled
  if (!identityEnabled && !(await IdentityPrivacyRepository.hasUserFootprint(user.id))) {
    notFound()
  }
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('Identity verification')}</h1>
        <p className="text-muted-foreground">{t('Review your requirements, continue a saved application, or manage your identity data.')}</p>
      </div>
      <SettingsIdentityVerificationContent locale={locale} />
    </section>
  )
}
