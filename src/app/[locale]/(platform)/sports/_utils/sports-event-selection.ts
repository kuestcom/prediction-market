export function buildMarketSlugSelectionSignature({
  activeCardId,
  marketSlugToButtonKey,
  usesSectionLayout,
}: {
  activeCardId: string
  marketSlugToButtonKey: string | null
  usesSectionLayout: boolean
}) {
  if (!marketSlugToButtonKey) {
    return null
  }

  return `${activeCardId}:${usesSectionLayout ? 'section' : 'aux'}:${marketSlugToButtonKey}`
}
