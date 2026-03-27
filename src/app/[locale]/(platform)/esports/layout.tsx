import { notFound } from 'next/navigation'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import SportsLayoutShell from '@/app/[locale]/(platform)/sports/_components/SportsLayoutShell'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export default async function EsportsLayout({ children }: LayoutProps<'/[locale]/esports'>) {
  const { data: layoutData } = await SportsMenuRepository.getLayoutData('esports')
  if (!layoutData) {
    notFound()
  }

  return (
    <TradingOnboardingProvider>
      <SportsLayoutShell
        vertical="esports"
        sportsCountsBySlug={layoutData.countsBySlug}
        sportsMenuEntries={layoutData.menuEntries}
        canonicalSlugByAliasKey={layoutData.canonicalSlugByAliasKey}
        h1TitleBySlug={layoutData.h1TitleBySlug}
        sectionsBySlug={layoutData.sectionsBySlug}
      >
        {children}
      </SportsLayoutShell>
    </TradingOnboardingProvider>
  )
}
