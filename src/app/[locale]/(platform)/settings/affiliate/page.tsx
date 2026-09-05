import type { SupportedLocale } from '@/i18n/locales'

import { redirect } from '@/i18n/navigation'

export default async function AffiliateSettingsRedirect({ params }: PageProps<'/[locale]/settings/affiliate'>) {
  const { locale } = await params
  redirect({ href: '/settings/rewards', locale: locale as SupportedLocale })
}
