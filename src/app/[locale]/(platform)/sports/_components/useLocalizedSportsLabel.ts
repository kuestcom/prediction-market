import { useExtracted } from 'next-intl'
import { useCallback } from 'react'

export function useLocalizedSportsLabel() {
  const t = useExtracted()

  return useCallback(
    (label: string) => {
      switch (label) {
        case 'Sports':
          return t('Sports')
        case 'Esports':
          return t('Esports')
        case 'Futures':
          return t('Futures')
        case 'Upcoming':
          return t('Upcoming')
        case 'All Sports':
          return t('All Sports')
        case 'All':
          return t('All')
        case 'Games':
          return t('Games')
        case 'Moneyline':
          return t('Moneyline')
        case 'Spread':
          return t('Spread')
        case 'Total':
          return t('Total')
        case 'Totals':
          return t('Totals')
        case 'Market':
          return t('Market')
        case 'Both Teams to Score':
          return t('Both Teams to Score')
        case 'Both Teams to Score?':
          return t('Both Teams to Score?')
        case 'Draw':
          return t('Draw')
        case 'DRAW':
          return t('Draw')
        case 'YES':
          return t('Yes')
        case 'NO':
          return t('No')
        case 'Neither':
          return t('Neither')
        case 'Over':
          return t('Over')
        case 'Under':
          return t('Under')
        case 'Map':
          return t('Map')
        case 'Maps':
          return t('Maps')
        case 'Game':
          return t('Game')
        case 'Line':
          return t('Line')
        default:
          return label
      }
    },
    [t],
  )
}
