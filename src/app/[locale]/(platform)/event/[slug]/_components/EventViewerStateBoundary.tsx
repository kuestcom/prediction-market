import { cookies } from 'next/headers'
import EventViewerState from '@/app/[locale]/(platform)/event/[slug]/_components/EventViewerState'

const AUTH_SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  'better-auth.session_data',
  '__Secure-better-auth.session_data',
]

export default async function EventViewerStateBoundary() {
  const cookieStore = await cookies()
  const shouldHydrateSession = AUTH_SESSION_COOKIE_NAMES.some(name => Boolean(cookieStore.get(name)?.value))

  return <EventViewerState shouldHydrateSession={shouldHydrateSession} />
}
