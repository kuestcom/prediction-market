'use cache'

import SportsLayoutShell from '@/app/[locale]/(platform)/sports/_components/SportsLayoutShell'
import { EventRepository } from '@/lib/db/queries/event'

export default async function SportsLayout({ children }: LayoutProps<'/[locale]/sports'>) {
  const { data: sportsCountsBySlug } = await EventRepository.getActiveSportsCountsBySlug()
  return (
    <SportsLayoutShell sportsCountsBySlug={sportsCountsBySlug ?? {}}>
      {children}
    </SportsLayoutShell>
  )
}
