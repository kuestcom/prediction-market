'use client'

import { RefreshCwIcon } from 'lucide-react'
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
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <RefreshCwIcon className="size-4 text-muted-foreground" />
          {t('Synced market sources')}
        </h3>
      )}
    >
      <div className="grid gap-4">
        <AllowedMarketCreatorsManager disabled={isPending} />
      </div>
    </SettingsAccordionSection>
  )
}

export default MarketFeeSection
