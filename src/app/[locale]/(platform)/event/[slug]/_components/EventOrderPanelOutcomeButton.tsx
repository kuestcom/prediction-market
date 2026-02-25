import type { OddsFormat } from '@/lib/odds-format'
import { Button } from '@/components/ui/button'
import { formatCentsLabel } from '@/lib/formatters'
import { formatOddsFromPrice } from '@/lib/odds-format'
import { cn } from '@/lib/utils'

interface EventOrderPanelOutcomeButtonProps {
  variant: 'yes' | 'no'
  price: number | null
  label: string
  isSelected: boolean
  oddsFormat?: OddsFormat
  styleVariant?: 'default' | 'sports3d'
  onSelect: () => void
}

export default function EventOrderPanelOutcomeButton({
  variant,
  price,
  label,
  isSelected,
  oddsFormat = 'price',
  styleVariant = 'default',
  onSelect,
}: EventOrderPanelOutcomeButtonProps) {
  const useSportsDepth = styleVariant === 'sports3d'
  const priceLabel = oddsFormat === 'price'
    ? formatCentsLabel(price)
    : formatOddsFromPrice(price, oddsFormat)

  if (useSportsDepth) {
    const depthClass = isSelected
      ? (variant === 'yes' ? 'bg-yes/70' : 'bg-no/70')
      : 'bg-border/70'
    const toneClass = isSelected
      ? (variant === 'yes'
          ? 'bg-yes text-white hover:bg-yes-foreground'
          : 'bg-no text-white hover:bg-no-foreground')
      : 'bg-secondary text-secondary-foreground hover:bg-accent'

    return (
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg pb-1.25">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-lg',
            depthClass,
          )}
        />
        <button
          type="button"
          className={cn(
            `
              relative flex h-[48px] w-full translate-y-0 items-center justify-center gap-1 rounded-lg px-3 text-sm
              font-semibold whitespace-nowrap shadow-sm transition-transform duration-150 ease-out
              hover:translate-y-px
              focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none
              active:translate-y-0.5
            `,
            toneClass,
          )}
          onClick={onSelect}
        >
          <span className="truncate opacity-70">
            {label}
          </span>
          <span className="shrink-0 text-base font-bold">
            {priceLabel}
          </span>
        </button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant={isSelected ? variant : 'outline'}
      size="outcomeLg"
      className={cn(
        isSelected
        && (variant === 'yes'
          ? 'bg-yes text-white hover:bg-yes-foreground'
          : 'bg-no text-white hover:bg-no-foreground'),
      )}
      onClick={onSelect}
    >
      <span className="truncate opacity-70">
        {label}
      </span>
      <span className="shrink-0 text-base font-bold">
        {priceLabel}
      </span>
    </Button>
  )
}
