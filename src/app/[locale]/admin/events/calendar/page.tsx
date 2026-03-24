import { setRequestLocale } from 'next-intl/server'
import AdminCreateEventCalendar from '@/app/[locale]/admin/events/calendar/_components/AdminCreateEventCalendar'

export default async function AdminCreateEventPage({ params }: PageProps<'/[locale]/admin/events/calendar'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <AdminCreateEventCalendar />
}
