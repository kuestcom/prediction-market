import { setRequestLocale } from 'next-intl/server'

import type { SupportedLocale } from '@/i18n/locales'

import { redirect } from '@/i18n/navigation'

export default async function AffiliateSettingsRedirect({ params }: PageProps<'/[locale]/settings/affiliate'>) {
  const { locale } = await params
  setRequestLocale(locale)

  redirect({ href: '/settings/rewards', locale: locale as SupportedLocale })
}
