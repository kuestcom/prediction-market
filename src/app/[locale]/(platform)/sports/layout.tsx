import { notFound } from 'next/navigation'
import SportsLayoutShell from '@/app/[locale]/(platform)/sports/_components/SportsLayoutShell'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export default async function SportsLayout({ children }: LayoutProps<'/[locale]/sports'>) {
  const { data: layoutData } = await SportsMenuRepository.getLayoutData('sports')
  if (!layoutData) {
    notFound()
  }

  return (
    <SportsLayoutShell
      vertical="sports"
      sportsCountsBySlug={layoutData.countsBySlug}
      sportsMenuEntries={layoutData.menuEntries}
      canonicalSlugByAliasKey={layoutData.canonicalSlugByAliasKey}
      h1TitleBySlug={layoutData.h1TitleBySlug}
      sectionsBySlug={layoutData.sectionsBySlug}
    >
      {children}
    </SportsLayoutShell>
  )
}
