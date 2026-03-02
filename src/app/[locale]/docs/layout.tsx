import { RootProvider } from 'fumadocs-ui/provider/next'
import { setRequestLocale } from 'next-intl/server'

export default async function Layout({ params, children }: LayoutProps<'/[locale]/docs'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <RootProvider
      search={{
        options: {
          api: '/docs/api/search',
        },
      }}
    >
      {children}
    </RootProvider>
  )
}
