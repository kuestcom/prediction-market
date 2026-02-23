import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'

export default async function SportsFuturesRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect('/sports/futures/nba' as never)
}
