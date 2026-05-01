'use client'

import type { ChangeEventHandler, FormEventHandler } from 'react'
import type { PendingWithdrawalItem } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FuelIcon,
  InfoIcon,
  WalletIcon,
} from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { WITHDRAW_CHAIN_OPTIONS, WITHDRAW_TOKEN_OPTIONS } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDisplayAmount, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'

function WalletSendForm({
  sendTo,
  onChangeSendTo,
  sendAmount,
  onChangeSendAmount,
  isSending,
  onSubmitSend,
  onBack,
  connectedWalletAddress,
  onUseConnectedWallet,
  availableBalance,
  onMax,
  isBalanceLoading = false,
  pendingWithdrawals = [],
}: {
  sendTo: string
  onChangeSendTo: ChangeEventHandler<HTMLInputElement>
  sendAmount: string
  onChangeSendAmount: (value: string) => void
  isSending: boolean
  onSubmitSend: FormEventHandler<HTMLFormElement>
  onBack?: () => void
  connectedWalletAddress?: string | null
  onUseConnectedWallet?: () => void
  availableBalance?: number | null
  onMax?: () => void
  isBalanceLoading?: boolean
  pendingWithdrawals?: PendingWithdrawalItem[]
}) {
  const trimmedRecipient = sendTo.trim()
  const isRecipientAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedRecipient)
  const parsedAmount = Number(sendAmount)
  const [receiveToken, setReceiveToken] = useState<string>('USDC')
  const [receiveChain, setReceiveChain] = useState<string>('Polygon')
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const inputValue = formatDisplayAmount(sendAmount)
  const isSubmitDisabled = (
    isSending
    || !trimmedRecipient
    || !isRecipientAddress
    || !Number.isFinite(parsedAmount)
    || parsedAmount <= 0
  )
  const showConnectedWalletButton = !sendTo?.trim()
  const amountDisplay = Number.isFinite(parsedAmount)
    ? parsedAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
  const receiveAmountDisplay = Number.isFinite(parsedAmount)
    ? parsedAmount.toLocaleString('en-US', {
        minimumFractionDigits: 5,
        maximumFractionDigits: 5,
      })
    : '0.00000'
  const formattedBalance = Number.isFinite(availableBalance)
    ? Number(availableBalance).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
  const balanceDisplay = isBalanceLoading
    ? <Skeleton className="h-4 w-16" />
    : formattedBalance
  const selectedToken = WITHDRAW_TOKEN_OPTIONS.find(option => option.value === receiveToken)
  const selectedChain = WITHDRAW_CHAIN_OPTIONS.find(option => option.value === receiveChain)
  const visiblePendingWithdrawals = pendingWithdrawals.slice(0, 2)

  function handleAmountChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numericValue = Number.parseFloat(cleaned)

    if (cleaned === '' || numericValue <= MAX_AMOUNT_INPUT) {
      onChangeSendAmount(cleaned)
    }
  }

  function handleAmountBlur(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numeric = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numeric)) {
      onChangeSendAmount('')
      return
    }

    const clampedValue = Math.min(numeric, MAX_AMOUNT_INPUT)
    onChangeSendAmount(formatAmountInputValue(clampedValue))
  }

  return (
    <div className="space-y-5">
      {onBack && (
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </button>
      )}

      <form className="mt-2 grid gap-4" onSubmit={onSubmitSend}>
        <div className="grid gap-2">
          <Label htmlFor="wallet-send-to">Recipient address</Label>
          <div className="relative">
            <Input
              id="wallet-send-to"
              value={sendTo}
              onChange={onChangeSendTo}
              placeholder="0x..."
              className={cn('h-12 text-sm placeholder:text-sm', { 'pr-28': showConnectedWalletButton })}
              required
            />
            {showConnectedWalletButton && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onUseConnectedWallet}
                disabled={!connectedWalletAddress}
                className="absolute inset-y-2 right-2 text-xs"
              >
                <WalletIcon className="size-3.5 shrink-0" />
                <span>use connected</span>
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wallet-send-amount">Amount</Label>
          <div className="relative">
            <Input
              id="wallet-send-amount"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={event => handleAmountChange(event.target.value)}
              onBlur={event => handleAmountBlur(event.target.value)}
              placeholder="0.00"
              className={`
                h-12 [appearance:textfield] pr-36 text-sm
                [&::-webkit-inner-spin-button]:appearance-none
                [&::-webkit-outer-spin-button]:appearance-none
              `}
              required
            />
            <div className="absolute inset-y-2 right-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">USDC</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-foreground hover:text-muted-foreground"
                onClick={onMax}
                disabled={!onMax || isBalanceLoading}
              >
                Max
              </Button>
            </div>
          </div>
          <div className="mx-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              $
              {amountDisplay}
            </span>
            <span className="flex items-center gap-1">
              <span>Balance:</span>
              <span>{balanceDisplay}</span>
              <span>USDC</span>
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Receive token</Label>
            <Select value={receiveToken} onValueChange={setReceiveToken}>
              <SelectTrigger className="h-12 w-full justify-between">
                <div className="flex items-center gap-2">
                  {selectedToken && (
                    <Image
                      src={selectedToken.icon}
                      alt={selectedToken.label}
                      width={20}
                      height={20}
                    />
                  )}
                  <span className="text-sm font-medium">{selectedToken?.label ?? 'Select token'}</span>
                </div>
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={6}>
                {WITHDRAW_TOKEN_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value} disabled={!option.enabled}>
                    <div className="flex items-center gap-2">
                      <Image src={option.icon} alt={option.label} width={18} height={18} />
                      <span className="text-sm">{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Receive chain</Label>
            <Select value={receiveChain} onValueChange={setReceiveChain}>
              <SelectTrigger className="h-12 w-full justify-between">
                <div className="flex items-center gap-2">
                  {selectedChain && (
                    <Image
                      src={selectedChain.icon}
                      alt={selectedChain.label}
                      width={20}
                      height={20}
                    />
                  )}
                  <span className="text-sm font-medium">{selectedChain?.label ?? 'Select chain'}</span>
                </div>
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={6}>
                {WITHDRAW_CHAIN_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value} disabled={!option.enabled}>
                    <div className="flex items-center gap-2">
                      <Image src={option.icon} alt={option.label} width={18} height={18} />
                      <span className="text-sm">{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">You will receive</span>
            <div className="flex items-center gap-3 text-right">
              <span className="text-foreground">
                {receiveAmountDisplay}
                {' '}
                {receiveToken}
              </span>
              <span className="text-muted-foreground">
                $
                {amountDisplay}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm text-muted-foreground"
            onClick={() => setIsBreakdownOpen(current => !current)}
          >
            <span>Transaction breakdown</span>
            <span className="flex items-center gap-1">
              {!isBreakdownOpen && <span>0.00%</span>}
              <ChevronRightIcon
                className={cn('size-4 transition', { 'rotate-90': isBreakdownOpen })}
              />
            </span>
          </button>
          {isBreakdownOpen && (
            <TooltipProvider>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span>Network cost</span>
                        <InfoIcon className="size-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs text-foreground">
                        <div className="flex items-center justify-between gap-4">
                          <span>Total cost</span>
                          <span className="text-right">$0.00</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Source chain gas</span>
                          <span className="text-right">$0.00</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Destination chain gas</span>
                          <span className="text-right">$0.00</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-1">
                    <FuelIcon className="size-4" />
                    <span>$0.00</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span>Price impact</span>
                        <InfoIcon className="size-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs text-foreground">
                        <div className="flex items-center justify-between gap-4">
                          <span>Total impact</span>
                          <span className="text-right">0.00%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Swap impact</span>
                          <span className="text-right">0.00%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Fun.xyz fee</span>
                          <span className="text-right">0.00%</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span>0.00%</span>
                </div>
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span>Max slippage</span>
                        <InfoIcon className="size-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Slippage occurs due to price changes during trade execution. Minimum received: $0.00
                    </TooltipContent>
                  </Tooltip>
                  <span>Auto • 0.00%</span>
                </div>
              </div>
            </TooltipProvider>
          )}
        </div>

        {visiblePendingWithdrawals.length > 0 && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="space-y-2 text-xs text-foreground">
              <p className="font-semibold">Pending withdrawal</p>
              {visiblePendingWithdrawals.map((pendingWithdrawal) => {
                const amount = Number(pendingWithdrawal.amount)
                const formattedAmount = Number.isFinite(amount)
                  ? amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : pendingWithdrawal.amount
                const shortAddress = pendingWithdrawal.to.length > 12
                  ? `${pendingWithdrawal.to.slice(0, 6)}...${pendingWithdrawal.to.slice(-4)}`
                  : pendingWithdrawal.to

                return (
                  <div key={pendingWithdrawal.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{shortAddress}</span>
                    <span className="font-semibold tabular-nums">
                      $
                      {formattedAmount}
                    </span>
                  </div>
                )
              })}
              <p className="text-muted-foreground">
                Shown locally until wallet sync catches up.
              </p>
            </div>
          </div>
        )}

        <Button type="submit" className="h-12 w-full gap-2 text-base" disabled={isSubmitDisabled}>
          {isSending ? 'Submitting…' : 'Withdraw'}
        </Button>
      </form>
    </div>
  )
}

export default WalletSendForm
