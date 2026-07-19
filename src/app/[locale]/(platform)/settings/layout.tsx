import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import SettingsSidebar from '@/app/[locale]/(platform)/settings/_components/SettingsSidebar'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { parseIdentitySettings } from '@/lib/identity/settings'

async function IdentityAwareSettingsSidebar() {
  const [{ data: settings }, user] = await Promise.all([
    SettingsRepository.getSettings(),
    UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true }),
  ])
  const identityEnabled = parseIdentitySettings(settings).enabled
  const identityAvailable = identityEnabled || Boolean(user && await IdentityPrivacyRepository.hasUserFootprint(user.id))

  return <SettingsSidebar identityEnabled={identityAvailable} />
}

export default async function SettingsLayout({ params, children }: LayoutProps<'/[locale]/settings'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-4 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-16">
          <Suspense fallback={<SettingsSidebar identityEnabled={false} />}>
            <IdentityAwareSettingsSidebar />
          </Suspense>
          {children}
        </div>
      </div>
    </main>
  )
}
