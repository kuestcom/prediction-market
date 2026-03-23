import { setRequestLocale } from 'next-intl/server'
import AdminCreateEventCalendar from '@/app/[locale]/admin/create-event/_components/AdminCreateEventCalendar'

export default async function AdminCreateEventPage({ params }: PageProps<'/[locale]/admin/create-event'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <AdminCreateEventCalendar />
}
