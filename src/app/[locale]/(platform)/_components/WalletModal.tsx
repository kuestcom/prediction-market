'use client'

import type { ChangeEventHandler, FormEventHandler } from 'react'
import type { LiFiWalletTokenItem } from '@/hooks/useLiFiWalletTokens'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  CreditCard,
  ExternalLink,
  Fuel,
  Info,
  Loader2,
  Wallet,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLiFiExecution } from '@/hooks/useLiFiExecution'
import { useLiFiQuote } from '@/hooks/useLiFiQuote'
import { useLiFiWalletTokens } from '@/hooks/useLiFiWalletTokens'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { POLYGON_SCAN_BASE } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { IS_TEST_MODE } from '@/lib/network'
import { svgLogo } from '@/lib/utils'

const MELD_PAYMENT_METHODS = [
  'apple_pay',
  'google_pay',
  'pix',
  'paypal',
  'neteller',
  'skrill',
  'binance',
  'coinbase',
] as const

const TRANSFER_PAYMENT_METHODS = [
  'polygon',
  'usdc',
] as const

const WITHDRAW_TOKEN_OPTIONS = [
  { value: 'USDC', label: 'USDC', icon: '/images/withdraw/token/usdc.svg', enabled: false },
  { value: 'USDC.e', label: 'USDC.e', icon: '/images/withdraw/token/usdc.svg', enabled: true },
  { value: 'ARB', label: 'ARB', icon: '/images/withdraw/token/arb.svg', enabled: false },
  { value: 'BNB', label: 'BNB', icon: '/images/withdraw/token/bsc.svg', enabled: false },
  { value: 'BTCB', label: 'BTCB', icon: '/images/withdraw/token/btc.svg', enabled: false },
  { value: 'BUSD', label: 'BUSD', icon: '/images/withdraw/token/busd.svg', enabled: false },
  { value: 'CBBTC', label: 'CBBTC', icon: '/images/withdraw/token/cbbtc.svg', enabled: false },
  { value: 'DAI', label: 'DAI', icon: '/images/withdraw/token/dai.svg', enabled: false },
  { value: 'ETH', label: 'ETH', icon: '/images/withdraw/token/eth.svg', enabled: false },
  { value: 'MATIC', label: 'MATIC', icon: '/images/withdraw/token/matic.svg', enabled: false },
  { value: 'POL', label: 'POL', icon: '/images/withdraw/token/matic.svg', enabled: false },
  { value: 'SOL', label: 'SOL', icon: '/images/withdraw/token/sol.svg', enabled: false },
  { value: 'USDe', label: 'USDe', icon: '/images/withdraw/token/usde.svg', enabled: false },
  { value: 'USDT', label: 'USDT', icon: '/images/withdraw/token/usdt.svg', enabled: false },
  { value: 'WBNB', label: 'WBNB', icon: '/images/withdraw/token/bsc.svg', enabled: false },
  { value: 'WETH', label: 'WETH', icon: '/images/withdraw/token/weth.svg', enabled: false },
] as const

const WITHDRAW_CHAIN_OPTIONS = [
  { value: 'Ethereum', label: 'Ethereum', icon: '/images/withdraw/chain/ethereum.svg', enabled: false },
  { value: 'Solana', label: 'Solana', icon: '/images/withdraw/chain/solana.svg', enabled: false },
  { value: 'BSC', label: 'BSC', icon: '/images/withdraw/chain/bsc.svg', enabled: false },
  { value: 'Base', label: 'Base', icon: '/images/withdraw/chain/base.svg', enabled: false },
  { value: 'Polygon', label: 'Polygon', icon: '/images/withdraw/chain/polygon.svg', enabled: true },
  { value: 'Arbitrum', label: 'Arbitrum', icon: '/images/withdraw/chain/arbitrum.svg', enabled: false },
  { value: 'Optimism', label: 'Optimism', icon: '/images/withdraw/chain/optimism.svg', enabled: false },
] as const

type WalletDepositView = 'fund' | 'receive' | 'wallets' | 'amount' | 'confirm' | 'success'

interface WalletDepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  walletAddress?: string | null
  walletEoaAddress?: string | null
  siteName?: string
  meldUrl: string | null
  hasDeployedProxyWallet: boolean
  view: WalletDepositView
  onViewChange: (view: WalletDepositView) => void
  onBuy: (url: string) => void
  walletBalance?: string | null
  isBalanceLoading?: boolean
}

interface WalletWithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  siteName?: string
  sendTo: string
  onChangeSendTo: ChangeEventHandler<HTMLInputElement>
  sendAmount: string
  onChangeSendAmount: (value: string) => void
  isSending: boolean
  onSubmitSend: FormEventHandler<HTMLFormElement>
  connectedWalletAddress?: string | null
  onUseConnectedWallet?: () => void
  availableBalance?: number | null
  onMax?: () => void
  isBalanceLoading?: boolean
}

function WalletAddressCard({
  walletAddress,
  onCopy,
  copied,
  label = 'Proxy wallet',
}: {
  walletAddress?: string | null
  onCopy: () => void
  copied: boolean
  label?: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCopy}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onCopy()
        }
      }}
      className={`
        cursor-pointer rounded-md border p-1.5 text-sm transition
        hover:bg-muted/40
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="ml-2 text-xs font-bold break-all">{walletAddress}</p>
        </div>
        <span className="inline-flex size-8 items-center justify-center">
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
        </span>
      </div>
    </div>
  )
}

function WalletReceiveView({
  walletAddress,
  siteName,
  onCopy,
  copied,
}: {
  walletAddress?: string | null
  siteName?: string
  onCopy: () => void
  copied: boolean
}) {
  const siteLabel = siteName ?? process.env.NEXT_PUBLIC_SITE_NAME!

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-muted-foreground">
          <span>
            Scan QR Code or copy your
            {' '}
            {siteLabel}
            {' '}
            wallet address to transfer
          </span>
          {' '}
          <span className="inline-flex items-center gap-1 align-middle">
            <Image
              src="/images/deposit/transfer/usdc_dark.png"
              alt="USDC"
              width={14}
              height={14}
              className="block"
            />
            <span>USDC</span>
          </span>
          {' '}
          <span>on</span>
          {' '}
          <span className="inline-flex items-center gap-1 align-middle">
            <Image
              src="/images/deposit/transfer/polygon_dark.png"
              alt="Polygon"
              width={14}
              height={14}
              className="block"
            />
            <span>Polygon</span>
          </span>
        </p>
        <div className="flex justify-center">
          <div className="rounded-lg border bg-white p-2 transition">
            {walletAddress
              ? <QRCode value={walletAddress} size={200} />
              : <p className="text-sm">Proxy wallet not ready yet.</p>}
          </div>
        </div>
      </div>
      <WalletAddressCard
        walletAddress={walletAddress}
        onCopy={onCopy}
        copied={copied}
        label=""
      />
    </div>
  )
}

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
}) {
  const trimmedRecipient = sendTo.trim()
  const isRecipientAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedRecipient)
  const parsedAmount = Number(sendAmount)
  const [receiveToken, setReceiveToken] = useState<string>('USDC.e')
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
  const isUsdcESelected = receiveToken === 'USDC.e'

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
          <ArrowLeft className="size-4" />
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
              className={`${showConnectedWalletButton ? 'pr-28' : ''} h-12 text-sm placeholder:text-sm`}
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
                <Wallet className="size-3.5 shrink-0" />
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
                h-12
                [appearance:textfield]
                pr-36 text-sm
                [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
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
              <ChevronRight
                className={`size-4 transition ${isBreakdownOpen ? 'rotate-90' : ''}`}
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
                        <Info className="size-4" />
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
                    <Fuel className="size-4" />
                    <span>$0.00</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span>Price impact</span>
                        <Info className="size-4" />
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
                        <Info className="size-4" />
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

        {isUsdcESelected && (
          <div className="rounded-lg bg-muted/60 p-4">
            <div className="flex items-start gap-3 text-xs text-foreground">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive">
                <Info className="size-4 text-background" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">USDCe is not widely supported by most exchanges</p>
                <p className="text-muted-foreground">
                  Sending USDCe to an unsupported platform may result in a permanent loss of funds. Always double-check token compatibility before transferring.
                </p>
              </div>
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

function WalletFundMenu({
  onBuy,
  onReceive,
  onWallet,
  disabledBuy,
  disabledReceive,
  meldUrl,
  walletEoaAddress,
  walletBalance,
  isBalanceLoading,
}: {
  onBuy: (url: string) => void
  onReceive: () => void
  onWallet: () => void
  disabledBuy: boolean
  disabledReceive: boolean
  meldUrl: string | null
  walletEoaAddress?: string | null
  walletBalance?: string | null
  isBalanceLoading?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const logoVariant = isDark ? 'dark' : 'light'
  const paymentLogos = MELD_PAYMENT_METHODS.map(method => `/images/deposit/meld/${method}_${logoVariant}.png`)
  const transferLogos = TRANSFER_PAYMENT_METHODS.map(method => `/images/deposit/transfer/${method}_${logoVariant}.png`)
  const walletSuffix = walletEoaAddress?.slice(-4) ?? '----'
  const formattedWalletBalance = walletBalance && walletBalance !== '' ? walletBalance : '0.00'

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className={`
          group flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-2 text-left
          transition
          hover:bg-muted/50
          disabled:cursor-not-allowed disabled:opacity-50
        `}
        onClick={onWallet}
        disabled={IS_TEST_MODE}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center text-foreground">
            <Wallet className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Wallet (...
              {walletSuffix}
              )
              {IS_TEST_MODE && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`
                        ml-2 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground
                      `}
                      >
                        <Info className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Wallet deposits are not available in test mode.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isBalanceLoading
                ? <Skeleton className="h-3 w-10 rounded-full" />
                : (
                    <span>
                      $
                      {formattedWalletBalance}
                    </span>
                  )}
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span>Instant</span>
            </div>
          </div>
        </div>
      </button>

      <div className="mx-auto flex w-full items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border/70" />
        <span>more</span>
        <div className="h-px flex-1 bg-border/70" />
      </div>

      <button
        type="button"
        className={`
          group flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-2 text-left
          transition
          hover:bg-muted/50
          disabled:cursor-not-allowed disabled:opacity-50
        `}
        onClick={() => {
          if (!meldUrl) {
            return
          }
          onBuy(meldUrl)
        }}
        disabled={disabledBuy}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center text-foreground">
            <CreditCard className="size-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Buy Crypto</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>card</span>
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span>bank wire</span>
            </div>
          </div>
        </div>
        <div className="flex items-center -space-x-2 transition-all group-hover:-space-x-1">
          {paymentLogos.map(logo => (
            <div
              key={logo}
              className="relative size-5 overflow-hidden rounded-full bg-background shadow-sm"
            >
              <Image
                src={logo}
                alt="Meld payment method"
                fill
                sizes="24px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </button>

      <button
        type="button"
        className={`
          group flex w-full items-center justify-between gap-4 rounded-lg border border-border px-4 py-2 text-left
          transition
          hover:bg-muted/50
          disabled:cursor-not-allowed disabled:opacity-50
        `}
        onClick={onReceive}
        disabled={disabledReceive}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center text-foreground">
            <CircleDollarSign className="size-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Transfer Funds</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>USDC</span>
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span>copy wallet or scan QR code</span>
            </div>
          </div>
        </div>
        <div className="flex items-center -space-x-2 transition-all group-hover:-space-x-1">
          {transferLogos.map(logo => (
            <div
              key={logo}
              className="relative size-6 overflow-hidden rounded-full bg-background shadow-sm"
            >
              <Image
                src={logo}
                alt="Transfer method icon"
                fill
                sizes="28px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </button>
    </div>
  )
}

function WalletTokenList({
  onContinue,
  items,
  isLoadingTokens,
  selectedId,
  onSelect,
}: {
  onContinue: () => void
  items: Array<{
    id: string
    symbol: string
    network: string
    icon: string
    chainIcon?: string
    balance: string
    usd: string
    disabled: boolean
  }>
  isLoadingTokens: boolean
  selectedId: string
  onSelect: (id: string) => void
}) {
  const showEmptyState = !isLoadingTokens && items.length === 0

  return (
    <div className="space-y-4">
      <div className="max-h-90 overflow-y-scroll pr-1">
        <div className="space-y-2">
          {isLoadingTokens && (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`wallet-token-skeleton-${index}`}
                className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-1.5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex align-middle">
                    <span className="size-8.5 animate-pulse rounded-full bg-accent" />
                  </span>
                  <div className="space-y-1">
                    <span className="inline-flex align-middle">
                      <span className="h-4 w-16 animate-pulse rounded-md bg-accent" />
                    </span>
                    <span className="inline-flex align-middle">
                      <span className="h-3 w-24 animate-pulse rounded-md bg-accent" />
                    </span>
                  </div>
                </div>
                <span className="inline-flex align-middle">
                  <span className="h-6 w-16 animate-pulse rounded-md bg-accent" />
                </span>
              </div>
            ))
          )}
          {showEmptyState && (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No LI.FI-supported tokens with balance found.
            </div>
          )}
          {items.map((item) => {
            const isSelected = selectedId === item.id
            const isDisabled = item.disabled
            const chainIconSrc = item.chainIcon ?? '/images/deposit/transfer/polygon_dark.png'
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onSelect(item.id)
                  }
                }}
                className={`
                  flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition
                  ${isSelected ? 'border border-foreground/20' : 'border border-transparent'}
                  ${isDisabled ? 'cursor-not-allowed opacity-50' : isSelected ? '' : 'hover:bg-muted/50'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Image
                          src={item.icon}
                          alt={item.symbol}
                          width={34}
                          height={34}
                          className="rounded-full"
                          unoptimized
                        />
                        <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                          {chainIconSrc.startsWith('http')
                            ? (
                                <Image
                                  src={chainIconSrc}
                                  alt={item.network}
                                  width={14}
                                  height={14}
                                  className="rounded-full"
                                  unoptimized
                                />
                              )
                            : (
                                <Image
                                  src={chainIconSrc}
                                  alt={item.network}
                                  width={14}
                                  height={14}
                                  className="rounded-full"
                                />
                              )}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {item.symbol}
                      {' '}
                      on
                      {' '}
                      {item.network}
                    </TooltipContent>
                  </Tooltip>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{item.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.balance}
                      {' '}
                      {item.symbol}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDisabled && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Low Balance
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Minimum required: $2.00
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <span className="text-lg font-semibold text-foreground">
                    $
                    {item.usd}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="-mx-6 border-t" />
      <Button
        type="button"
        className="h-12 w-full"
        onClick={onContinue}
        disabled={!selectedId || isLoadingTokens || showEmptyState}
      >
        Continue
      </Button>
    </div>
  )
}

function WalletAmountStep({
  onContinue,
  selectedTokenSymbol,
  availableTokenAmount,
  amountValue,
  onAmountChange,
}: {
  onContinue: () => void
  selectedTokenSymbol?: string | null
  availableTokenAmount?: number | null
  amountValue: string
  onAmountChange: (value: string) => void
}) {
  const hasAvailableTokenAmount = typeof availableTokenAmount === 'number' && Number.isFinite(availableTokenAmount)

  function handleInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numericValue = Number.parseFloat(cleaned)

    if (cleaned === '' || numericValue <= MAX_AMOUNT_INPUT) {
      onAmountChange(cleaned)
    }
  }

  function handleBlur(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numeric = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numeric)) {
      onAmountChange('')
      return
    }

    const clampedValue = Math.min(numeric, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(clampedValue))
  }

  function handleQuickFill(label: string) {
    if (!hasAvailableTokenAmount) {
      return
    }

    const baseValue = Math.min(availableTokenAmount ?? 0, MAX_AMOUNT_INPUT)

    if (label === 'Max') {
      onAmountChange(formatAmountInputValue(baseValue, { roundingMode: 'floor' }))
      return
    }

    const percentValue = Number.parseInt(label.replace('%', ''), 10) / 100
    const nextValue = baseValue * percentValue
    onAmountChange(formatAmountInputValue(nextValue))
  }

  const amountNumber = Number.parseFloat(amountValue || '0')
  const isAmountExceedingBalance = hasAvailableTokenAmount && amountNumber > (availableTokenAmount ?? 0)
  const isAmountInvalid = !amountValue.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0
  const availableTokenLabel = hasAvailableTokenAmount
    ? (availableTokenAmount as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : null
  const amountSizeClass = getAmountSizeClass(amountValue, {
    large: 'text-6xl',
    medium: 'text-5xl',
    small: 'text-4xl',
  })
  const inputValue = formatDisplayAmount(amountValue)
  const quickLabels = ['25%', '50%', '75%', 'Max']
  const placeholderText = selectedTokenSymbol ? `0.00 ${selectedTokenSymbol}` : '0.00'
  const minChWidth = placeholderText.length + 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => {
            handleInputChange(event.target.value)
          }}
          onBlur={(event) => {
            handleBlur(event.target.value)
          }}
          placeholder={placeholderText}
          className={`
            min-h-[1.2em] bg-transparent pb-1 text-center leading-tight font-semibold text-foreground outline-none
            placeholder:leading-tight
            ${amountSizeClass}
          `}
          style={{ width: `${Math.max(inputValue.length, minChWidth)}ch`, maxWidth: '70vw' }}
        />
        {selectedTokenSymbol && (
          <span className="pb-1 text-xl leading-tight font-semibold text-muted-foreground">
            {selectedTokenSymbol}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {quickLabels.map(label => (
          <button
            key={label}
            type="button"
            className={`
              rounded-md bg-muted/60 px-4 py-2 text-sm text-foreground transition hover:bg-muted
              ${!hasAvailableTokenAmount ? 'cursor-not-allowed opacity-50' : ''}
            `}
            disabled={!hasAvailableTokenAmount}
            onClick={() => handleQuickFill(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {isAmountExceedingBalance && (
        <p className="text-center text-sm font-medium text-destructive">
          Amount exceeds the available balance
          {selectedTokenSymbol ? ` for ${selectedTokenSymbol}` : ''}
          {availableTokenLabel ? ` (${availableTokenLabel} ${selectedTokenSymbol ?? ''})` : ''}
          .
        </p>
      )}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-muted/60 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/deposit/transfer/polygon_dark.png"
                alt="POL"
                width={30}
                height={30}
                className="rounded-full"
              />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                <Image
                  src="/images/deposit/transfer/polygon_dark.png"
                  alt="Polygon"
                  width={14}
                  height={14}
                  className="rounded-full"
                />
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">You send</p>
              <p className="text-sm font-semibold text-foreground">{selectedTokenSymbol ?? 'Token'}</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/deposit/transfer/usdc_dark.png"
                alt="USDC"
                width={30}
                height={30}
                className="rounded-full"
              />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                <Image
                  src="/images/deposit/transfer/polygon_dark.png"
                  alt="Polygon"
                  width={14}
                  height={14}
                  className="rounded-full"
                />
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">You receive</p>
              <p className="text-sm font-semibold text-foreground">USDC</p>
            </div>
          </div>
        </div>
      </div>
      <Button
        type="button"
        className="h-12 w-full"
        onClick={onContinue}
        disabled={isAmountExceedingBalance || isAmountInvalid}
      >
        Continue
      </Button>
    </div>
  )
}

function CountdownBadge({
  seconds = 30,
  onReset,
}: {
  seconds?: number
  onReset?: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const endTimeRef = useRef(Date.now() + seconds * 1000)
  const hasTriggeredResetRef = useRef(false)
  const onResetRef = useRef(onReset)

  useEffect(() => {
    onResetRef.current = onReset
  }, [onReset])

  useEffect(() => {
    setRemaining(seconds)
    endTimeRef.current = Date.now() + seconds * 1000
    hasTriggeredResetRef.current = false
    const interval = setInterval(() => {
      const now = Date.now()
      let diff = endTimeRef.current - now
      if (diff <= 0) {
        if (!hasTriggeredResetRef.current) {
          hasTriggeredResetRef.current = true
          onResetRef.current?.()
        }
        endTimeRef.current = Date.now() + seconds * 1000
        diff = endTimeRef.current - now
        hasTriggeredResetRef.current = false
      }
      const next = Math.max(0, Math.ceil(diff / 1000))
      setRemaining(next)
    }, 250)

    return () => clearInterval(interval)
  }, [seconds])

  const size = 36
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progressRatio = seconds > 0 ? remaining / seconds : 0
  const dashOffset = circumference * (1 - progressRatio)

  return (
    <div className="absolute top-4 right-4">
      <div className="relative size-9">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-muted-foreground/40"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="text-primary"
          />
        </svg>
        <div className={`
          absolute inset-0.75 flex items-center justify-center rounded-full bg-background text-[9px] font-semibold
          text-foreground ring-1 ring-border/60
        `}
        >
          {remaining}
        </div>
      </div>
    </div>
  )
}

function WalletConfirmStep({
  walletEoaAddress,
  walletAddress,
  siteLabel,
  onComplete,
  amountValue,
  selectedToken,
  quote,
  refreshIndex,
}: {
  walletEoaAddress?: string | null
  walletAddress?: string | null
  siteLabel: string
  onComplete: () => void
  amountValue: string
  selectedToken?: LiFiWalletTokenItem | null
  quote?: { toAmountDisplay: string | null, gasUsdDisplay: string | null } | null
  refreshIndex: number
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const eoaSuffix = walletEoaAddress?.slice(-4) ?? '542d'
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const logoSvg = svgLogo()
  const formattedAmount = formatDisplayAmount(amountValue)
  const displayAmount = formattedAmount && formattedAmount.trim() !== '' ? formattedAmount : '0.00'
  const { quote: fetchedQuote, isLoadingQuote } = useLiFiQuote({
    fromToken: selectedToken,
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
    refreshIndex,
  })
  const effectiveQuote = quote ?? fetchedQuote
  const hasAmount = amountValue.trim() !== ''
  const isQuoteLoading = isLoadingQuote && hasAmount
  const status: 'quote' | 'gas' | 'ready' = effectiveQuote ? 'ready' : (isLoadingQuote ? 'gas' : 'quote')
  const {
    execute,
    isExecuting,
  } = useLiFiExecution({
    fromToken: selectedToken,
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
  })
  const isCtaDisabled = isExecuting || isSubmitting || !effectiveQuote || isLoadingQuote
  const sendSymbol = selectedToken?.symbol ?? 'Token'
  const sendIcon = selectedToken?.icon ?? '/images/deposit/transfer/polygon_dark.png'
  const chainIcon = selectedToken?.chainIcon ?? '/images/deposit/transfer/polygon_dark.png'
  const receiveAmountDisplay = effectiveQuote?.toAmountDisplay ?? '—'
  const gasUsdDisplay = effectiveQuote?.gasUsdDisplay ?? null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center">
        <p className="text-5xl font-semibold text-foreground">
          {displayAmount}
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Source</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Wallet className="size-4" />
                Wallet (...
                {eoaSuffix}
                )
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Destination</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span
                  className={`
                    size-4 text-current
                    [&_svg]:h-[1em] [&_svg]:w-[1em]
                    [&_svg_*]:fill-current [&_svg_*]:stroke-current
                  `}
                  dangerouslySetInnerHTML={{ __html: logoSvg! }}
                />
                {siteLabel}
                {' '}
                Wallet
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Estimated time</span>
              <span className="font-semibold text-foreground">&lt; 1 min</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You send</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="relative">
                  <Image
                    src={sendIcon}
                    alt={sendSymbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                    unoptimized
                  />
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                    <Image
                      src={chainIcon}
                      alt={selectedToken?.network ?? 'Chain'}
                      width={10}
                      height={10}
                      className="rounded-full"
                      unoptimized={chainIcon.startsWith('http')}
                    />
                  </span>
                </span>
                {displayAmount}
                {' '}
                {sendSymbol}
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You receive</span>
              {isQuoteLoading
                ? <Skeleton className="h-4 w-28 rounded-full" />
                : (
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <span className="relative">
                        <Image
                          src="/images/deposit/transfer/usdc_dark.png"
                          alt="USDC"
                          width={18}
                          height={18}
                          className="rounded-full"
                        />
                        <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                          <Image
                            src="/images/deposit/transfer/polygon_dark.png"
                            alt="Polygon"
                            width={10}
                            height={10}
                            className="rounded-full"
                          />
                        </span>
                      </span>
                      {receiveAmountDisplay}
                      {' '}
                      USDC
                    </span>
                  )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs text-muted-foreground"
          onClick={() => setIsBreakdownOpen(current => !current)}
          disabled={isQuoteLoading}
        >
          <span>Transaction breakdown</span>
          <span className="flex items-center gap-1">
            {isQuoteLoading
              ? <Skeleton className="h-3 w-20 rounded-full" />
              : (
                  <>
                    {!isBreakdownOpen && <span>{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>}
                    <ChevronRight className={`size-3 transition ${isBreakdownOpen ? 'rotate-90' : ''}`} />
                  </>
                )}
          </span>
        </button>
        {isBreakdownOpen && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                Network cost
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs text-foreground">
                      <div className="flex items-center justify-between gap-4">
                        <span>Total cost</span>
                        <span className="text-right">{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Source chain gas</span>
                        <span className="text-right">{gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Destination chain gas</span>
                        <span className="text-right">—</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className="flex items-center gap-2">
                <Fuel className="size-3" />
                {gasUsdDisplay ? `$${gasUsdDisplay}` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      <Badge variant="outline" className="w-full p-3 text-muted-foreground">
        By clicking on Confirm Order, you agree to our
        {' '}
        <a
          href="/terms-of-use"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          terms
        </a>
        .
      </Badge>
      <Button
        type="button"
        className="h-12 w-full"
        disabled={isCtaDisabled}
        onClick={async () => {
          if (status !== 'ready') {
            return
          }
          try {
            setIsSubmitting(true)
            await execute()
            onComplete()
          }
          finally {
            setIsSubmitting(false)
          }
        }}
      >
        {(isLoadingQuote || isSubmitting || isExecuting) && <Loader2 className="size-4 animate-spin" />}
        {isSubmitting && 'Confirm transaction in your wallet'}
        {!isSubmitting && status === 'quote' && 'Preparing your quote...'}
        {!isSubmitting && status === 'gas' && 'Estimating gas...'}
        {!isSubmitting && status === 'ready' && 'Confirm order'}
      </Button>
    </div>
  )
}

function WalletSuccessStep({
  walletEoaAddress,
  walletAddress,
  siteLabel,
  amountValue,
  selectedToken,
  quote,
  onClose,
  onNewDeposit,
}: {
  walletEoaAddress?: string | null
  walletAddress?: string | null
  siteLabel: string
  amountValue: string
  selectedToken?: LiFiWalletTokenItem | null
  quote?: { toAmountDisplay: string | null, gasUsdDisplay: string | null } | null
  onClose: () => void
  onNewDeposit: () => void
}) {
  const eoaSuffix = walletEoaAddress?.slice(-4) ?? '1234'
  const safeSuffix = walletAddress?.slice(-4) ?? '5678'
  const logoSvg = svgLogo()
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL
  const formattedAmount = formatDisplayAmount(amountValue)
  const displayAmount = formattedAmount && formattedAmount.trim() !== '' ? formattedAmount : '0.00'
  const sendSymbol = selectedToken?.symbol ?? 'Token'
  const sendIcon = selectedToken?.icon ?? '/images/deposit/transfer/polygon_dark.png'
  const chainIcon = selectedToken?.chainIcon ?? '/images/deposit/transfer/polygon_dark.png'
  const receiveAmountDisplay = quote?.toAmountDisplay ?? '—'

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-20 rounded-full bg-emerald-500/25 blur-md" />
          <div className="relative flex size-14 items-center justify-center rounded-full bg-emerald-500">
            <Check className="size-7 text-background" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">Deposit successful</p>
          <p className="text-sm text-muted-foreground">Your funds were successfully deposited.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Fill status</span>
              <span className="font-semibold text-emerald-500">Successful</span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Total time</span>
              <span className="font-semibold text-foreground">1 second</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Source</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Wallet className="size-4" />
                Wallet (...
                {eoaSuffix}
                )
                {walletEoaAddress && (
                  <a
                    href={`${POLYGON_SCAN_BASE}/address/${walletEoaAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex"
                    aria-label="View wallet on Polygonscan"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Destination</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span
                  className={`
                    size-4 text-current
                    [&_svg]:h-[1em] [&_svg]:w-[1em]
                    [&_svg_*]:fill-current [&_svg_*]:stroke-current
                  `}
                  dangerouslySetInnerHTML={{ __html: logoSvg! }}
                />
                {siteLabel}
                {' '}
                Wallet (...
                {safeSuffix}
                )
                {walletAddress && (
                  <a
                    href={`${POLYGON_SCAN_BASE}/address/${walletAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex"
                    aria-label="View wallet on Polygonscan"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You send</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="relative">
                  <Image
                    src={sendIcon}
                    alt={sendSymbol}
                    width={18}
                    height={18}
                    className="rounded-full"
                    unoptimized
                  />
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                    <Image
                      src={chainIcon}
                      alt={selectedToken?.network ?? 'Chain'}
                      width={10}
                      height={10}
                      className="rounded-full"
                      unoptimized={chainIcon.startsWith('http')}
                    />
                  </span>
                </span>
                {displayAmount}
                {' '}
                {sendSymbol}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>You receive</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Image
                  src="/images/deposit/transfer/usdc_dark.png"
                  alt="USDC"
                  width={18}
                  height={18}
                  className="rounded-full"
                />
                {receiveAmountDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>

      {supportUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-foreground">
          <Info className="size-4 text-muted-foreground" />
          <span>
            Experiencing problems?
            {' '}
            <a
              href={supportUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Get help
            </a>
            .
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" className="h-11 bg-muted text-foreground hover:bg-muted/80" onClick={onClose}>
          Close
        </Button>
        <Button type="button" className="h-11" onClick={onNewDeposit}>
          New Deposit
        </Button>
      </div>
    </div>
  )
}

export function WalletDepositModal(props: WalletDepositModalProps) {
  const {
    open,
    onOpenChange,
    isMobile,
    walletAddress,
    walletEoaAddress,
    siteName,
    meldUrl,
    hasDeployedProxyWallet,
    view,
    onViewChange,
    onBuy,
    walletBalance,
    isBalanceLoading = false,
  } = props

  const [copied, setCopied] = useState(false)
  const siteLabel = siteName ?? process.env.NEXT_PUBLIC_SITE_NAME!
  const tokensQueryEnabled = open && (view === 'wallets' || view === 'amount' || view === 'confirm')
  const { items: walletTokenItems, isLoadingTokens } = useLiFiWalletTokens(walletEoaAddress, { enabled: tokensQueryEnabled })
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [confirmRefreshIndex, setConfirmRefreshIndex] = useState(0)
  const formattedBalance = walletBalance && walletBalance !== ''
    ? walletBalance
    : '0.00'
  const balanceDisplay = isBalanceLoading
    ? (
        <span className="inline-flex align-middle">
          <span className="h-3 w-12 animate-pulse rounded-md bg-accent" />
        </span>
      )
    : (
        <>
          $
          {formattedBalance}
        </>
      )

  useEffect(() => {
    if (!walletTokenItems.length) {
      setSelectedTokenId('')
      return
    }

    setSelectedTokenId((currentSelectedId) => {
      if (currentSelectedId && walletTokenItems.some(item => item.id === currentSelectedId && !item.disabled)) {
        return currentSelectedId
      }

      const firstEnabledItem = walletTokenItems.find(item => !item.disabled)
      return firstEnabledItem?.id ?? walletTokenItems[0].id
    })
  }, [walletTokenItems])

  const selectedToken = walletTokenItems.find(item => item.id === selectedTokenId) ?? null
  const { quote } = useLiFiQuote({
    fromToken: selectedToken,
    amountValue,
    fromAddress: walletEoaAddress,
    toAddress: walletAddress,
    refreshIndex: confirmRefreshIndex,
  })

  const content = view === 'fund'
    ? (
        <WalletFundMenu
          onBuy={(url) => {
            onBuy(url)
          }}
          onReceive={() => onViewChange('receive')}
          onWallet={() => onViewChange('wallets')}
          disabledBuy={!meldUrl}
          disabledReceive={!hasDeployedProxyWallet}
          meldUrl={meldUrl}
          walletEoaAddress={walletEoaAddress}
          walletBalance={walletBalance}
          isBalanceLoading={isBalanceLoading}
        />
      )
    : view === 'receive'
      ? (
          <WalletReceiveView
            walletAddress={walletAddress}
            onCopy={handleCopy}
            copied={copied}
          />
        )
      : view === 'wallets'
        ? (
            <WalletTokenList
              onContinue={() => onViewChange('amount')}
              items={walletTokenItems}
              isLoadingTokens={isLoadingTokens}
              selectedId={selectedTokenId}
              onSelect={setSelectedTokenId}
            />
          )
        : view === 'amount'
          ? (
              <WalletAmountStep
                onContinue={() => onViewChange('confirm')}
                selectedTokenSymbol={selectedToken?.symbol ?? null}
                availableTokenAmount={selectedToken?.balanceRaw ?? null}
                amountValue={amountValue}
                onAmountChange={setAmountValue}
              />
            )
          : view === 'confirm'
            ? (
                <WalletConfirmStep
                  walletEoaAddress={walletEoaAddress}
                  walletAddress={walletAddress}
                  siteLabel={siteLabel}
                  onComplete={() => onViewChange('success')}
                  amountValue={amountValue}
                  selectedToken={selectedToken}
                  quote={quote}
                  refreshIndex={confirmRefreshIndex}
                />
              )
            : (
                <WalletSuccessStep
                  walletEoaAddress={walletEoaAddress}
                  walletAddress={walletAddress}
                  siteLabel={siteLabel}
                  amountValue={amountValue}
                  selectedToken={selectedToken}
                  quote={quote}
                  onClose={() => onOpenChange(false)}
                  onNewDeposit={() => onViewChange('fund')}
                />
              )

  async function handleCopy() {
    if (!walletAddress) {
      return
    }
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
    catch {
      //
    }
  }

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next) => {
          setCopied(false)
          onOpenChange(next)
        }}
      >
        <DrawerContent className="max-h-[90vh] w-full bg-background px-0">
          <DrawerHeader className="gap-1 px-4 pt-3 pb-2">
            <div className="flex items-center">
              {view !== 'fund' && view !== 'success'
                ? (
                    <button
                      type="button"
                      className={`
                        rounded-md p-2 opacity-70 ring-offset-background transition
                        hover:bg-muted hover:opacity-100
                        focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden
                        disabled:pointer-events-none
                        [&_svg]:pointer-events-none [&_svg]:shrink-0
                        [&_svg:not([class*='size-'])]:size-4
                      `}
                      onClick={() => onViewChange('fund')}
                    >
                      <ChevronLeft />
                    </button>
                  )
                : (
                    <span className="size-8" aria-hidden="true" />
                  )}
              <DrawerTitle className="flex-1 text-center text-xl font-semibold text-foreground">Deposit</DrawerTitle>
              <span className="size-8" aria-hidden="true" />
            </div>
            <DrawerDescription className="text-center text-xs text-muted-foreground">
              {siteLabel}
              {' '}
              Balance:
              {' '}
              {balanceDisplay}
            </DrawerDescription>
          </DrawerHeader>
          <div className="border-t" />
          <div className="w-full px-4 pb-4">
            <div className="space-y-4 pt-4">
              {content}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setCopied(false)
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md border bg-background pt-4 sm:max-w-md"
        showCloseButton={view !== 'confirm'}
      >
        {view === 'confirm' && (
          <CountdownBadge
            onReset={() => setConfirmRefreshIndex(current => current + 1)}
          />
        )}
        <DialogHeader className="gap-1">
          <div className="flex items-center">
            {view !== 'fund' && view !== 'success'
              ? (
                  <button
                    type="button"
                    className={`
                      rounded-md p-2 opacity-70 ring-offset-background transition
                      hover:bg-muted hover:opacity-100
                      focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden
                      disabled:pointer-events-none
                      [&_svg]:pointer-events-none [&_svg]:shrink-0
                      [&_svg:not([class*='size-'])]:size-4
                    `}
                    onClick={() => onViewChange('fund')}
                  >
                    <ChevronLeft />
                  </button>
                )
              : (
                  <span className="size-8" aria-hidden="true" />
                )}
            <DialogTitle className="flex-1 text-center text-lg font-semibold text-foreground">Deposit</DialogTitle>
            <span className="size-8" aria-hidden="true" />
          </div>
          <DialogDescription className="text-center text-xs text-muted-foreground">
            {siteLabel}
            {' '}
            Balance:
            {' '}
            {balanceDisplay}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 border-t" />
        {content}
      </DialogContent>
    </Dialog>
  )
}

export function WalletWithdrawModal(props: WalletWithdrawModalProps) {
  const {
    open,
    onOpenChange,
    isMobile,
    siteName,
    sendTo,
    onChangeSendTo,
    sendAmount,
    onChangeSendAmount,
    isSending,
    onSubmitSend,
    connectedWalletAddress,
    onUseConnectedWallet,
    availableBalance,
    onMax,
    isBalanceLoading,
  } = props

  const content = (
    <WalletSendForm
      sendTo={sendTo}
      onChangeSendTo={onChangeSendTo}
      sendAmount={sendAmount}
      onChangeSendAmount={onChangeSendAmount}
      isSending={isSending}
      onSubmitSend={onSubmitSend}
      connectedWalletAddress={connectedWalletAddress}
      onUseConnectedWallet={onUseConnectedWallet}
      availableBalance={availableBalance}
      onMax={onMax}
      isBalanceLoading={isBalanceLoading}
    />
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-0">
          <DrawerHeader className="px-4 pt-4 pb-2">
            <DrawerTitle className="text-center text-foreground">
              Withdraw from
              {' '}
              {siteName}
            </DrawerTitle>
          </DrawerHeader>
          <div className="w-full px-4 pb-4">
            <div className="space-y-4 pt-4">
              {content}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl border bg-background">
        <DialogHeader>
          <DialogTitle className="text-center text-foreground">
            Withdraw from
            {' '}
            {siteName}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
