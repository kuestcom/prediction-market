import { redirect } from 'next/navigation'

// Admin navigation intentionally allows request-time route data to block.
export const instant = false

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  redirect(`/${locale}/admin/general`)
}
