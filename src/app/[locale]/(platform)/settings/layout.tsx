import { setRequestLocale } from 'next-intl/server'
import SettingsSidebar from '@/app/[locale]/(platform)/settings/_components/SettingsSidebar'

export default async function SettingsLayout({ params, children }: LayoutProps<'/[locale]/settings'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-4 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-16">
          <SettingsSidebar />
          {children}
        </div>
      </div>
    </main>
  )
}
