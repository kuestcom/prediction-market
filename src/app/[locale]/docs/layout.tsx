import { setRequestLocale } from 'next-intl/server'
import { DocsRootProvider } from '@/components/docs/DocsRootProvider'
import './docs.css'

export default async function Layout({ params, children }: LayoutProps<'/[locale]/docs'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <DocsRootProvider>
      {children}
    </DocsRootProvider>
  )
}
