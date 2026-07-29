'use client'

import type { EventOrderPanelOutcomeSelectedAccent } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import type { OddsFormat } from '@/lib/odds-format'

import EventOrderPanelOutcomeButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'

interface EventOrderPanelOutcomeSelectorProps {
  primaryPrice: number | null
  secondaryPrice: number | null
  primaryLabel: string
  secondaryLabel: string
  primaryIsSelected: boolean
  secondaryIsSelected: boolean
  oddsFormat: OddsFormat
  styleVariant: 'default' | 'sports3d'
  primarySelectedAccent: EventOrderPanelOutcomeSelectedAccent | null
  secondarySelectedAccent: EventOrderPanelOutcomeSelectedAccent | null
  onSelectPrimary: () => void
  onSelectSecondary: () => void
}

export default function EventOrderPanelOutcomeSelector({
  primaryPrice,
  secondaryPrice,
  primaryLabel,
  secondaryLabel,
  primaryIsSelected,
  secondaryIsSelected,
  oddsFormat,
  styleVariant,
  primarySelectedAccent,
  secondarySelectedAccent,
  onSelectPrimary,
  onSelectSecondary,
}: EventOrderPanelOutcomeSelectorProps) {
  return (
    <div className="mb-2 flex gap-2">
      <EventOrderPanelOutcomeButton
        variant="yes"
        price={primaryPrice}
        label={primaryLabel}
        isSelected={primaryIsSelected}
        oddsFormat={oddsFormat}
        styleVariant={styleVariant}
        selectedAccent={primarySelectedAccent}
        onSelect={onSelectPrimary}
      />
      <EventOrderPanelOutcomeButton
        variant="no"
        price={secondaryPrice}
        label={secondaryLabel}
        isSelected={secondaryIsSelected}
        oddsFormat={oddsFormat}
        styleVariant={styleVariant}
        selectedAccent={secondarySelectedAccent}
        onSelect={onSelectSecondary}
      />
    </div>
  )
}
