'use cache'

import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import SportsLayoutShell from '@/app/[locale]/(platform)/sports/_components/SportsLayoutShell'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export default async function SportsLayout({ children }: LayoutProps<'/[locale]/sports'>) {
  const { data: layoutData } = await SportsMenuRepository.getLayoutData()
  if (!layoutData) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="pt-5 pb-20 min-[1200px]:h-full min-[1200px]:min-h-0 md:pb-0" />}>
      <SportsLayoutShell
        sportsCountsBySlug={layoutData.countsBySlug}
        sportsMenuEntries={layoutData.menuEntries}
        canonicalSlugByAliasKey={layoutData.canonicalSlugByAliasKey}
        h1TitleBySlug={layoutData.h1TitleBySlug}
        sectionsBySlug={layoutData.sectionsBySlug}
      >
        {children}
      </SportsLayoutShell>
    </Suspense>
  )
}
