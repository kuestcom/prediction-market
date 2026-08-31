import { useExtracted } from 'next-intl'
import { useCallback } from 'react'

type OutcomeLabel = string | null | undefined

export function useOutcomeLabel() {
  const t = useExtracted()

  return useCallback(
    function normalizeOutcomeLabel(label: OutcomeLabel) {
      if (label === 'Yes') {
        return t('Yes')
      }
      if (label === 'No') {
        return t('No')
      }
      if (label === 'Up') {
        return t('Up')
      }
      if (label === 'Down') {
        return t('Down')
      }
      if (label === 'Unknown 50/50' || label === 'Inconclusive result') {
        return t('Inconclusive result')
      }
      return label ?? ''
    },
    [t],
  )
}
