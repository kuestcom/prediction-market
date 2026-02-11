import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import SettingsSidebar from '@/app/[locale]/(platform)/settings/_components/SettingsSidebar'

export async function generateMetadata({ params }: LayoutProps<'/[locale]/settings'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return {
    title: t('Settings'),
  }
}

export default async function SettingsLayout({ params, children }: LayoutProps<'/[locale]/settings'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-16">
          <SettingsSidebar />
          {children}
        </div>
      </div>
    </main>
  )
}
