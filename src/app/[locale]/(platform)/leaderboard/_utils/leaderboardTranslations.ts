import { useExtracted } from 'next-intl'

import type {
  CategoryValue,
  OrderValue,
  PeriodValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

export function useLeaderboardTranslations() {
  const t = useExtracted()

  function translateBiggestWins(period: string) {
    return t('Biggest wins {period}', { period })
  }

  function translateCategory(value: CategoryValue) {
    switch (value) {
      case 'politics':
        return t('Politics')
      case 'sports':
        return t('Sports')
      case 'crypto':
        return t('Crypto')
      case 'finance':
        return t('Finance')
      case 'culture':
        return t('Culture')
      case 'mentions':
        return t('Mentions')
      case 'weather':
        return t('Weather')
      case 'economics':
        return t('Economics')
      case 'tech':
        return t('Tech')
      case 'overall':
      default:
        return t('All Categories')
    }
  }

  function translatePeriod(value: PeriodValue) {
    switch (value) {
      case 'today':
        return t('Today')
      case 'weekly':
        return t('Weekly')
      case 'monthly':
        return t('Monthly')
      case 'all':
      default:
        return t('All')
    }
  }

  function translatePeriodQualifier(value: PeriodValue) {
    switch (value) {
      case 'today':
        return t('today')
      case 'weekly':
        return t('this week')
      case 'monthly':
        return t('this month')
      case 'all':
      default:
        return t('all time')
    }
  }

  function translateOrder(value: OrderValue) {
    return value === 'volume' ? t('Volume') : t('Profit/Loss')
  }

  function translateMedalAlt(value: string) {
    switch (value) {
      case 'Gold medal':
        return t('Gold medal')
      case 'Silver medal':
        return t('Silver medal')
      case 'Bronze medal':
        return t('Bronze medal')
      default:
        return value
    }
  }

  return {
    translateBiggestWins,
    translateCategory,
    translateLeaderboardTitle: () => t('Leaderboard'),
    translateMedalAlt,
    translateNextPage: () => t('Next page'),
    translateOrder,
    translatePeriod,
    translatePeriodQualifier,
    translatePreviousPage: () => t('Previous page'),
    translateSearchByName: () => t('Search by name'),
  }
}
