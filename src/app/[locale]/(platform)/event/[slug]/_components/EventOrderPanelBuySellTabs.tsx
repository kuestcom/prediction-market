import type { PointerEvent } from 'react'
import type { OrderSide, OrderType } from '@/types'
import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
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
const HOVER_MENU_CLOSE_DELAY_MS = 120

interface EventOrderPanelBuySellTabsProps {
  className?: string
  edgeToEdge?: boolean
  mode: 'trade' | 'arbitrage'
  showArbitrage: boolean
  side: OrderSide
  type: OrderType
  availableMergeShares: number
  availableSplitBalance: number
  eventId: string
  eventSlug: string
  isNegRiskMarket?: boolean
  negRiskAdapterAddress?: `0x${string}` | null
  conditionId?: string
  marketSlug?: string | null
  eventPath?: string | null
  marketTitle?: string | null
  marketIconUrl?: string | null
  onSideChange: (side: OrderSide) => void
  onTypeChange: (type: OrderType) => void
  onModeChange: (mode: 'trade' | 'arbitrage') => void
  onAmountReset: () => void
  onFocusInput: () => void
}

function useOrderTypePersistence(type: OrderType) {
  useEffect(function persistOrderTypeToStorage() {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, type)
    }
    catch {}
  }, [type])
}

function useHoverCloseMenu() {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimeout = useCallback(function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const handleTypeMenuEnter = useCallback(function handleTypeMenuEnter(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      return
    }

    clearCloseTimeout()
    setTypeMenuOpen(true)
  }, [clearCloseTimeout])

  const handleTypeMenuLeave = useCallback(function handleTypeMenuLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') {
      return
    }

    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      setTypeMenuOpen(false)
    }, HOVER_MENU_CLOSE_DELAY_MS)
  }, [clearCloseTimeout])

  useEffect(function cleanupHoverCloseTimeoutOnUnmount() {
    return function clearHoverCloseTimeout() {
      clearCloseTimeout()
    }
  }, [clearCloseTimeout])

  return { typeMenuOpen, setTypeMenuOpen, handleTypeMenuEnter, handleTypeMenuLeave }
}

export default function EventOrderPanelBuySellTabs({
  className,
  edgeToEdge = false,
  mode,
  showArbitrage,
  side,
  type,
  availableMergeShares,
  availableSplitBalance,
  eventId,
  eventSlug,
  isNegRiskMarket = false,
  negRiskAdapterAddress = null,
  conditionId,
  marketSlug,
  eventPath,
  marketTitle,
  marketIconUrl,
  onSideChange,
  onTypeChange,
  onModeChange,
  onAmountReset,
  onFocusInput,
}: EventOrderPanelBuySellTabsProps) {
  const t = useExtracted()
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false)
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false)
  const { typeMenuOpen, setTypeMenuOpen, handleTypeMenuEnter, handleTypeMenuLeave } = useHoverCloseMenu()

  useOrderTypePersistence(type)

  function handleSideChange(nextSide: OrderSide) {
    onSideChange(nextSide)
    onAmountReset()
    onFocusInput()
  }

  const orderTypeLabel = mode === 'arbitrage'
    ? t('Arbitrage')
    : type === ORDER_TYPE.MARKET ? t('Market') : t('Limit')

  function handleModeValueChange(value: string) {
    if (value === 'arbitrage') {
      onModeChange('arbitrage')
      return
    }
    onModeChange('trade')
    onTypeChange(value as OrderType)
  }

  return (
    <div className={cn('relative mb-4', edgeToEdge && '-mx-4 px-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm font-semibold">
          {mode === 'arbitrage'
            ? (
                <div className="border-b-3 border-[#2E5CFF] pb-2 text-base font-semibold text-foreground">
                  Polymarket
                </div>
              )
            : (
                <>
                  <button
                    type="button"
                    className={cn(
                      `
                        cursor-pointer rounded-none border-b-3 border-transparent bg-transparent px-0 pb-2 text-base
                        font-semibold text-muted-foreground transition-colors duration-200
                        hover:bg-transparent! hover:text-foreground
                        focus:bg-transparent!
                        focus-visible:bg-transparent! focus-visible:outline-none
                        active:bg-transparent!
                        dark:hover:bg-transparent!
                        dark:focus:bg-transparent!
                        dark:focus-visible:bg-transparent!
                        dark:active:bg-transparent!
                      `,
                      { 'border-foreground text-foreground': side === ORDER_SIDE.BUY },
                    )}
                    onClick={() => handleSideChange(ORDER_SIDE.BUY)}
                  >
                    {t('Buy')}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      `
                        cursor-pointer rounded-none border-b-3 border-transparent bg-transparent px-0 pb-2 text-base
                        font-semibold text-muted-foreground transition-colors duration-200
                        hover:bg-transparent! hover:text-foreground
                        focus:bg-transparent!
                        focus-visible:bg-transparent! focus-visible:outline-none
                        active:bg-transparent!
                        dark:hover:bg-transparent!
                        dark:focus:bg-transparent!
                        dark:focus-visible:bg-transparent!
                        dark:active:bg-transparent!
                      `,
                      { 'border-foreground text-foreground': side === ORDER_SIDE.SELL },
                    )}
                    onClick={() => handleSideChange(ORDER_SIDE.SELL)}
                  >
                    {t('Sell')}
                  </button>
                </>
              )}
        </div>

        <div onPointerEnter={handleTypeMenuEnter} onPointerLeave={handleTypeMenuLeave}>
          <DropdownMenu open={typeMenuOpen} onOpenChange={setTypeMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(`
                  group flex cursor-pointer items-center gap-1 bg-transparent pb-2 text-sm font-semibold
                  transition-colors duration-200
                  focus:outline-none
                  focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none
                `, { 'text-foreground': typeMenuOpen })}
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
                    { 'text-foreground': typeMenuOpen },
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36" portalled={false}>
              <DropdownMenuRadioGroup value={mode === 'arbitrage' ? 'arbitrage' : type} onValueChange={handleModeValueChange}>
                <DropdownMenuRadioItem
                  value={ORDER_TYPE.MARKET}
                  className={cn(`
                    cursor-pointer pl-2
                    data-[state=checked]:font-semibold data-[state=checked]:text-foreground
                    [&>span:first-of-type]:hidden
                  `)}
                >
                  {t('Market')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value={ORDER_TYPE.LIMIT}
                  className={cn(`
                    cursor-pointer pl-2
                    data-[state=checked]:font-semibold data-[state=checked]:text-foreground
                    [&>span:first-of-type]:hidden
                  `)}
                >
                  {t('Limit')}
                </DropdownMenuRadioItem>
                {showArbitrage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem
                      value="arbitrage"
                      className={cn(`
                        cursor-pointer pl-2 text-[#2E5CFF]
                        data-[state=checked]:font-semibold data-[state=checked]:text-[#2E5CFF]
                        [&>span:first-of-type]:hidden
                      `)}
                    >
                      {t('Arbitrage')}
                    </DropdownMenuRadioItem>
                  </>
                )}
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className={cn(`
                    cursor-pointer text-muted-foreground
                    focus:text-muted-foreground
                    data-[state=open]:text-muted-foreground
                    [&_svg]:text-muted-foreground
                  `)}
                >
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
        className={cn(
          'pointer-events-none absolute bottom-0 h-px bg-border',
          edgeToEdge ? 'inset-x-0' : '-inset-x-4',
        )}
      />

      <EventMergeSharesDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        availableShares={availableMergeShares}
        conditionId={conditionId}
        eventId={eventId}
        eventSlug={eventSlug}
        marketSlug={marketSlug ?? undefined}
        eventPath={eventPath}
        marketTitle={marketTitle ?? undefined}
        marketIconUrl={marketIconUrl}
        isNegRiskMarket={isNegRiskMarket}
        negRiskAdapterAddress={negRiskAdapterAddress}
      />
      <EventSplitSharesDialog
        open={isSplitDialogOpen}
        onOpenChange={setIsSplitDialogOpen}
        availableUsdc={availableSplitBalance}
        conditionId={conditionId}
        eventPath={eventPath}
        marketTitle={marketTitle ?? undefined}
        marketIconUrl={marketIconUrl}
        isNegRiskMarket={isNegRiskMarket}
        negRiskAdapterAddress={negRiskAdapterAddress}
      />
    </div>
  )
}
