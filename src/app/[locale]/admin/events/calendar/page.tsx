import { setRequestLocale } from 'next-intl/server'
import AdminCreateEventCalendar from '@/app/[locale]/admin/events/calendar/_components/AdminCreateEventCalendar'

// Admin navigation intentionally allows request-time route data to block.
export const instant = false

export default async function AdminCreateEventPage({ params }: PageProps<'/[locale]/admin/events/calendar'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <AdminCreateEventCalendar />
}
