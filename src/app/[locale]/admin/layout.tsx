'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import AdminHeader from '@/app/[locale]/admin/_components/AdminHeader'
import AdminSidebar from '@/app/[locale]/admin/_components/AdminSidebar'
import AppKitProvider from '@/providers/AppKitProvider'

export const metadata: Metadata = {
  title: 'Admin',
}

export default async function AdminLayout({ params, children }: LayoutProps<'/[locale]/admin'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <AppKitProvider>
      <PlatformViewerState />
      <AdminHeader />
      <main className="container py-4 lg:py-8">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-16">
          <AdminSidebar />
          <div className="space-y-8">
            {children}
          </div>
        </div>
      </main>
    </AppKitProvider>
  )
}
