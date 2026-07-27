import { redirect } from 'next/navigation'

export const instant = false

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  redirect(`/${locale}/admin/general`)
}
