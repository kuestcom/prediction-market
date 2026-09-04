import { useExtracted } from 'next-intl'
import { useCallback } from 'react'

const reportedUntranslatedLabels = new Set<string>()

function reportUntranslatedSportsLabel(label: string) {
  if (process.env.NODE_ENV !== 'development' || !label || reportedUntranslatedLabels.has(label)) {
    return
  }

  reportedUntranslatedLabels.add(label)
  console.warn(`[sports-i18n] Untranslated sports label: ${label}`)
}

export function useLocalizedSportsLabel() {
  const t = useExtracted()

  return useCallback(
    (label: string) => {
      const normalizedLabel = label.trim().replace(/\s+/g, ' ')
      const halfSuffixMatch = normalizedLabel.match(/^(.*\S)\s+([12]H)$/i)
      const baseLabel = halfSuffixMatch?.[1] ?? normalizedLabel
      const totalOutcomeMatch = baseLabel.match(/^(over|under)(\s+\d+(?:[.,]\d+)?)?$/i)
      let translatedLabel = label

      if (totalOutcomeMatch?.[1]) {
        translatedLabel = totalOutcomeMatch[1].toLowerCase() === 'over' ? t('Over') : t('Under')
        translatedLabel += totalOutcomeMatch[2] ?? ''
      } else {
        switch (baseLabel.toLowerCase()) {
          case 'sports':
            translatedLabel = t('Sports')
            break
          case 'esports':
            translatedLabel = t('Esports')
            break
          case 'futures':
            translatedLabel = t('Futures')
            break
          case 'upcoming':
            translatedLabel = t('Upcoming')
            break
          case 'all sports':
            translatedLabel = t('All Sports')
            break
          case 'all':
            translatedLabel = t('All')
            break
          case 'games':
            translatedLabel = t('Games')
            break
          case 'moneyline':
            translatedLabel = t('Moneyline')
            break
          case 'spread':
            translatedLabel = t('Spread')
            break
          case 'total':
            translatedLabel = t('Total')
            break
          case 'totals':
            translatedLabel = t('Totals')
            break
          case 'market':
            translatedLabel = t('Market')
            break
          case 'both teams to score':
            translatedLabel = t('Both Teams to Score')
            break
          case 'both teams to score?':
            translatedLabel = t('Both Teams to Score?')
            break
          case 'draw':
            translatedLabel = t('Draw')
            break
          case 'yes':
            translatedLabel = t('Yes')
            break
          case 'no':
            translatedLabel = t('No')
            break
          case 'neither':
            translatedLabel = t('Neither')
            break
          case 'map':
            translatedLabel = t('Map')
            break
          case 'maps':
            translatedLabel = t('Maps')
            break
          case 'game':
            translatedLabel = t('Game')
            break
          case 'line':
            translatedLabel = t('Line')
            break
          case 'live':
            translatedLabel = t('Live')
            break
          case 'props':
            translatedLabel = t('Props')
            break
          case 'other':
            translatedLabel = t('Other')
            break
          case 'halves':
            translatedLabel = t('Halves')
            break
          case 'tennis':
            translatedLabel = t('Tennis')
            break
          case 'cricket':
            translatedLabel = t('Cricket')
            break
          default:
            reportUntranslatedSportsLabel(normalizedLabel)
        }
      }

      if (halfSuffixMatch?.[2] && translatedLabel !== label) {
        return `${translatedLabel} ${halfSuffixMatch[2].toUpperCase()}`
      }

      return translatedLabel
    },
    [t],
  )
}
