import { setRequestLocale } from 'next-intl/server'

export default async function TwoFactorLayout({ params, children }: LayoutProps<'/[locale]/2fa'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      {children}
    </main>
  )
}
