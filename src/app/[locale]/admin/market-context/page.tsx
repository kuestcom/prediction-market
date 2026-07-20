import { redirect } from 'next/navigation'

export default async function AdminMarketContextSettingsPage({ params }: PageProps<'/[locale]/admin/market-context'>) {
  const { locale } = await params
  redirect(`/${locale}/admin/general`)
}
