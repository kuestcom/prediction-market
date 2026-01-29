import { useExtracted } from 'next-intl'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatSharesLabel } from '@/lib/formatters'

type ActiveOutcome = typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | undefined

interface EventOrderPanelUserSharesProps {
  yesShares: number
  noShares: number
  activeOutcome?: ActiveOutcome
}

export default function EventOrderPanelUserShares({ yesShares, noShares, activeOutcome }: EventOrderPanelUserSharesProps) {
  const t = useExtracted()
  const shouldShow = yesShares > 0 || noShares > 0
  if (!shouldShow) {
    return null
  }

  const formattedYesShares = formatSharesLabel(yesShares)
  const formattedNoShares = formatSharesLabel(noShares)
  const yesClass = activeOutcome === OUTCOME_INDEX.YES ? 'text-yes' : 'text-muted-foreground'
  const noClass = activeOutcome === OUTCOME_INDEX.NO ? 'text-no' : 'text-muted-foreground'

  return (
    <div className="mb-4 flex gap-2">
      <div className="flex-1 text-center">
        <span className={`text-xs font-semibold ${yesClass}`}>
          {formattedYesShares}
          {' '}
          {t('shares')}
        </span>
      </div>
      <div className="flex-1 text-center">
        <span className={`text-xs font-semibold ${noClass}`}>
          {formattedNoShares}
          {' '}
          {t('shares')}
        </span>
      </div>
    </div>
  )
}
