import { DocsRootProvider } from '@/app/[locale]/docs/_components/DocsRootProvider'

import './docs.css'

export default async function Layout({ children }: LayoutProps<'/[locale]/docs'>) {
  return <DocsRootProvider>{children}</DocsRootProvider>
}
