import type { PointerEvent } from 'react'

import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { OrderSide, OrderType } from '@/types'

import EventMergeSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventMergeSharesDialog'
import EventSplitSharesDialog from '@/app/[locale]/(platform)/event/[slug]/_components/EventSplitSharesDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  isNegRiskMarket?: boolean
  negRiskAdapterAddress?: `0x${string}` | null
  conditionId?: string
  eventPath?: string | null
  marketTitle?: string | null
  marketIconUrl?: string | null
  onSideChange: (side: OrderSide) => void
  onTypeChange: (type: OrderType) => void
  onModeChange: (mode: 'trade' | 'arbitrage') => void
  onAmountReset: () => void
  onFocusInput: () => void
}

interface OrderPanelTabProps {
  activeTone?: 'foreground' | 'primary'
  label: string
  selected: boolean
  onSelect: () => void
}

function OrderPanelTab({ activeTone = 'primary', label, selected, onSelect }: OrderPanelTabProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'relative px-2 py-2.5 text-sm font-semibold transition-colors',
        selected
          ? activeTone === 'primary'
            ? 'text-primary'
            : 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
      onClick={onSelect}
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors',
          selected ? (activeTone === 'primary' ? 'bg-primary' : 'bg-foreground') : 'bg-transparent',
        )}
      />
    </button>
  )
}

function useOrderTypePersistence(type: OrderType) {
  useEffect(
    function persistOrderTypeToStorage() {
      if (typeof window === 'undefined') {
        return
      }

      try {
        window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, type)
      } catch {}
    },
    [type],
  )
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

  const handleTypeMenuEnter = useCallback(
    function handleTypeMenuEnter(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== 'mouse') {
        return
      }

      clearCloseTimeout()
      setTypeMenuOpen(true)
    },
    [clearCloseTimeout],
  )

  const handleTypeMenuLeave = useCallback(
    function handleTypeMenuLeave(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== 'mouse') {
        return
      }

      clearCloseTimeout()
      closeTimeoutRef.current = setTimeout(() => {
        setTypeMenuOpen(false)
      }, HOVER_MENU_CLOSE_DELAY_MS)
    },
    [clearCloseTimeout],
  )

  useEffect(
    function cleanupHoverCloseTimeoutOnUnmount() {
      return function clearHoverCloseTimeout() {
        clearCloseTimeout()
      }
    },
    [clearCloseTimeout],
  )

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
  isNegRiskMarket = false,
  negRiskAdapterAddress = null,
  conditionId,
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
    if (side === nextSide) {
      return
    }
    onSideChange(nextSide)
    onAmountReset()
    onFocusInput()
  }

  function handleTradingTypeChange(nextType: OrderType) {
    if (mode === 'trade' && type === nextType) {
      return
    }
    onModeChange('trade')
    onTypeChange(nextType)
  }

  return (
    <div className={cn('relative', mode === 'trade' && 'mb-4', edgeToEdge && '-mx-4 px-4', className)}>
      <div className="flex border-b">
        <div
          className={cn('grid flex-1', showArbitrage ? 'grid-cols-3' : 'grid-cols-2')}
          role="group"
          aria-label={
            showArbitrage ? `${t('Market')}, ${t('Arbitrage')}, ${t('Limit')}` : `${t('Market')}, ${t('Limit')}`
          }
        >
          <OrderPanelTab
            label={t('Market')}
            selected={mode === 'trade' && type === ORDER_TYPE.MARKET}
            onSelect={() => handleTradingTypeChange(ORDER_TYPE.MARKET)}
          />
          {showArbitrage && (
            <OrderPanelTab
              label={t('Arbitrage')}
              selected={mode === 'arbitrage'}
              onSelect={() => onModeChange('arbitrage')}
            />
          )}
          <OrderPanelTab
            label={t('Limit')}
            selected={mode === 'trade' && type === ORDER_TYPE.LIMIT}
            onSelect={() => handleTradingTypeChange(ORDER_TYPE.LIMIT)}
          />
        </div>

        <div
          className="flex shrink-0 items-stretch"
          onPointerEnter={handleTypeMenuEnter}
          onPointerLeave={handleTypeMenuLeave}
        >
          <DropdownMenu open={typeMenuOpen} onOpenChange={setTypeMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  `group flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none`,
                  { 'text-foreground': typeMenuOpen },
                )}
                aria-haspopup="menu"
                aria-expanded={typeMenuOpen}
                aria-label={`${t('Merge')} / ${t('Split')}`}
              >
                <ChevronDownIcon
                  className={cn('size-4 transition-transform group-data-[state=open]:rotate-180', {
                    'rotate-180': typeMenuOpen,
                  })}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32" portalled={false}>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mode === 'trade' && (
        <div className="grid grid-cols-2 border-b" role="group" aria-label={`${t('Buy')} / ${t('Sell')}`}>
          <OrderPanelTab
            activeTone="foreground"
            label={t('Buy')}
            selected={side === ORDER_SIDE.BUY}
            onSelect={() => handleSideChange(ORDER_SIDE.BUY)}
          />
          <OrderPanelTab
            activeTone="foreground"
            label={t('Sell')}
            selected={side === ORDER_SIDE.SELL}
            onSelect={() => handleSideChange(ORDER_SIDE.SELL)}
          />
        </div>
      )}

      <EventMergeSharesDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        availableShares={availableMergeShares}
        conditionId={conditionId}
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
