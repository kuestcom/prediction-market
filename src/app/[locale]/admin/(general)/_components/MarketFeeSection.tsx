'use client'

import { useExtracted } from 'next-intl'
import AllowedMarketCreatorsManager from '@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager'
import SettingsAccordionSection from './SettingsAccordionSection'

interface MarketFeeSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
}

function MarketFeeSection({
  isPending,
  openSections,
  onToggleSection,
}: MarketFeeSectionProps) {
  const t = useExtracted()

  return (
    <SettingsAccordionSection
      value="market-fees"
      isOpen={openSections.includes('market-fees')}
      onToggle={onToggleSection}
      header={<h3 className="text-base font-medium">{t('Synced market sources')}</h3>}
    >
      <div className="grid gap-4">
        <AllowedMarketCreatorsManager disabled={isPending} />
      </div>
    </SettingsAccordionSection>
  )
}

export default MarketFeeSection
