import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

export default async function AdminIndexRedirectPage({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect('/admin/general')
}
