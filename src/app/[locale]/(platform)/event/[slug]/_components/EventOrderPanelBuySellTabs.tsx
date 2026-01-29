import type { PointerEvent } from 'react'
import type { OrderSide, OrderType } from '@/types'
import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import EventMergeSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventMergeSharesDialog'
import EventSplitSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventSplitSharesDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { cn } from '@/lib/utils'

const ORDER_TYPE_STORAGE_KEY = 'kuest:order-panel-type'

interface EventOrderPanelBuySellTabsProps {
  side: OrderSide
  type: OrderType
  availableMergeShares: number
  availableSplitBalance: number
  isNegRiskMarket?: boolean
  conditionId?: string
  marketTitle?: string | null
  onSideChange: (side: OrderSide) => void
  onTypeChange: (type: OrderType) => void
  onAmountReset: () => void
  onFocusInput: () => void
}

export default function EventOrderPanelBuySellTabs({
  side,
  type,
  availableMergeShares,
  availableSplitBalance,
  isNegRiskMarket = false,
  conditionId,
  marketTitle,
  onSideChange,
  onTypeChange,
  onAmountReset,
  onFocusInput,
}: EventOrderPanelBuySellTabsProps) {
  const t = useExtracted()
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasHydratedType = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (hasHydratedType.current) {
      return
    }

    hasHydratedType.current = true
    const storedType = window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY) as OrderType
    if (storedType && Object.values(ORDER_TYPE).includes(storedType as any) && storedType !== type) {
      onTypeChange(storedType)
    }
  }, [onTypeChange, type])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, type)
    }
    catch {}
  }, [type])

  function handleSideChange(nextSide: OrderSide) {
    onSideChange(nextSide)
    onAmountReset()
    onFocusInput()
  }

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function handleTypeMenuEnter(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      return
    }

    clearCloseTimeout()
    setTypeMenuOpen(true)
  }

  function handleTypeMenuLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      return
    }

    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setTypeMenuOpen(false)
    }, 120)
  }

  useEffect(() => () => clearCloseTimeout(), [])

  const orderTypeLabel = type === ORDER_TYPE.MARKET ? t('Market') : t('Limit')

  return (
    <div className="relative mb-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-4 text-sm font-semibold">
          <button
            type="button"
            className={cn(
              `
                cursor-pointer rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 text-sm font-semibold
                text-muted-foreground transition-colors duration-200
                hover:bg-transparent! hover:text-foreground
                focus:bg-transparent!
                focus-visible:bg-transparent! focus-visible:outline-none
                active:bg-transparent!
                dark:hover:bg-transparent! dark:focus:bg-transparent! dark:focus-visible:bg-transparent!
                dark:active:bg-transparent!
              `,
              side === ORDER_SIDE.BUY && 'border-foreground text-foreground',
            )}
            onClick={() => handleSideChange(ORDER_SIDE.BUY)}
          >
            {t('Buy')}
          </button>
          <button
            type="button"
            className={cn(
              `
                cursor-pointer rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 text-sm font-semibold
                text-muted-foreground transition-colors duration-200
                hover:bg-transparent! hover:text-foreground
                focus:bg-transparent!
                focus-visible:bg-transparent! focus-visible:outline-none
                active:bg-transparent!
                dark:hover:bg-transparent! dark:focus:bg-transparent! dark:focus-visible:bg-transparent!
                dark:active:bg-transparent!
              `,
              side === ORDER_SIDE.SELL && 'border-foreground text-foreground',
            )}
            onClick={() => handleSideChange(ORDER_SIDE.SELL)}
          >
            {t('Sell')}
          </button>
        </div>

        <div onPointerEnter={handleTypeMenuEnter} onPointerLeave={handleTypeMenuLeave}>
          <DropdownMenu open={typeMenuOpen} onOpenChange={setTypeMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(`
                  group flex cursor-pointer items-center gap-1 bg-transparent pb-2 text-sm font-semibold
                  text-muted-foreground transition-colors duration-200
                  hover:text-foreground
                  focus:outline-none
                  focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none
                `, typeMenuOpen && 'text-foreground')}
                aria-haspopup="menu"
                aria-expanded={typeMenuOpen}
              >
                {orderTypeLabel}
                <ChevronDownIcon
                  className={cn(
                    `
                      size-4 text-muted-foreground transition-all
                      group-hover:rotate-180
                      group-data-[state=open]:rotate-180
                    `,
                    typeMenuOpen && 'text-foreground',
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36" portalled={false}>
              <DropdownMenuRadioGroup value={type} onValueChange={value => onTypeChange(value as OrderType)}>
                <DropdownMenuRadioItem
                  value={ORDER_TYPE.MARKET}
                  className={`
                    cursor-pointer pl-2
                    data-[state=checked]:font-semibold data-[state=checked]:text-foreground
                    [&>span:first-of-type]:hidden
                  `}
                >
                  {t('Market')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value={ORDER_TYPE.LIMIT}
                  className={`
                    cursor-pointer pl-2
                    data-[state=checked]:font-semibold data-[state=checked]:text-foreground
                    [&>span:first-of-type]:hidden
                  `}
                >
                  {t('Limit')}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  {t('More')}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="min-w-32" alignOffset={-4}>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(event) => {
                        event.preventDefault()
                        setTypeMenuOpen(false)
                        setIsMergeDialogOpen(true)
                      }}
                    >
                      {t('Merge')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(event) => {
                        event.preventDefault()
                        setTypeMenuOpen(false)
                        setIsSplitDialogOpen(true)
                      }}
                    >
                      {t('Split')}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border"
      />

      <EventMergeSharesDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        availableShares={availableMergeShares}
        conditionId={conditionId}
        marketTitle={marketTitle ?? undefined}
        isNegRiskMarket={isNegRiskMarket}
      />
      <EventSplitSharesDialog
        open={isSplitDialogOpen}
        onOpenChange={setIsSplitDialogOpen}
        availableUsdc={availableSplitBalance}
        conditionId={conditionId}
        marketTitle={marketTitle ?? undefined}
        isNegRiskMarket={isNegRiskMarket}
      />
    </div>
  )
}
