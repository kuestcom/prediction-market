import { useExtracted } from 'next-intl'
import { useCallback } from 'react'

const reportedUntranslatedLabels = new Set<string>()

type ExtractedTranslator = ReturnType<typeof useExtracted>

function translateSportsLabel(label: string, t: ExtractedTranslator): string {
  const normalizedLabel = label.trim().replace(/\s+/g, ' ')
  const halfSuffixMatch = normalizedLabel.match(/^(.*\S)\s+([12]H)$/i)

  if (halfSuffixMatch?.[1] && halfSuffixMatch[2]) {
    const baseLabel = halfSuffixMatch[1]
    const translatedBaseLabel = translateSportsLabel(baseLabel, t)

    if (translatedBaseLabel !== baseLabel) {
      return `${translatedBaseLabel} ${halfSuffixMatch[2].toUpperCase()}`
    }
  }

  const totalOutcomeMatch = normalizedLabel.match(/^(over|under)(\s+.+)?$/i)
  if (totalOutcomeMatch?.[1]) {
    const translatedOutcome = totalOutcomeMatch[1].toLowerCase() === 'over' ? t('Over') : t('Under')
    return `${translatedOutcome}${totalOutcomeMatch[2] ?? ''}`
  }

  switch (normalizedLabel.toLowerCase()) {
    case 'sports':
      return t('Sports')
    case 'esports':
      return t('Esports')
    case 'futures':
      return t('Futures')
    case 'upcoming':
      return t('Upcoming')
    case 'all sports':
      return t('All Sports')
    case 'all':
      return t('All')
    case 'games':
      return t('Games')
    case 'moneyline':
      return t('Moneyline')
    case 'spread':
      return t('Spread')
    case 'total':
      return t('Total')
    case 'totals':
      return t('Totals')
    case 'market':
      return t('Market')
    case 'both teams to score':
      return t('Both Teams to Score')
    case 'both teams to score?':
      return t('Both Teams to Score?')
    case 'draw':
    case 'draw 1h':
    case 'draw 2h':
      return t('Draw')
    case 'yes':
      return t('Yes')
    case 'no':
      return t('No')
    case 'neither':
      return t('Neither')
    case 'over':
      return t('Over')
    case 'under':
      return t('Under')
    case 'map':
      return t('Map')
    case 'maps':
      return t('Maps')
    case 'game':
      return t('Game')
    case 'line':
      return t('Line')
    case 'live':
      return t('Live')
    case 'props':
      return t('Props')
    case 'other':
      return t('Other')
    case 'halves':
      return t('Halves')
    case 'tennis':
      return t('Tennis')
    case 'cricket':
      return t('Cricket')
    default:
      if (
        process.env.NODE_ENV === 'development' &&
        normalizedLabel &&
        !reportedUntranslatedLabels.has(normalizedLabel)
      ) {
        reportedUntranslatedLabels.add(normalizedLabel)
        console.warn(`[sports-i18n] Untranslated sports label: ${normalizedLabel}`)
      }

      return label
  }
}

export function useLocalizedSportsLabel() {
  const t = useExtracted()

  return useCallback((label: string) => translateSportsLabel(label, t), [t])
}
