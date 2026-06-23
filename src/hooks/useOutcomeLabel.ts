import { useExtracted } from 'next-intl'

type OutcomeLabel = string | null | undefined

export function useOutcomeLabel() {
  const t = useExtracted()

  return function normalizeOutcomeLabel(label: OutcomeLabel) {
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
    if (label === 'Unknown 50/50') {
      return t('Unknown 50/50')
    }
    return label ?? ''
  }
}
