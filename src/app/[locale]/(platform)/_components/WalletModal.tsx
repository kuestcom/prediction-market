'use client'

import type { WalletDepositModalProps, WalletWithdrawModalProps } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import { ChevronLeftIcon } from 'lucide-react'
import { useState } from 'react'
import CountdownBadge from '@/app/[locale]/(platform)/_components/wallet-modal/CountdownBadge'
import { getSelectedWalletTokenId } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import WalletAmountStep from '@/app/[locale]/(platform)/_components/wallet-modal/WalletAmountStep'
import WalletConfirmStep from '@/app/[locale]/(platform)/_components/wallet-modal/WalletConfirmStep'
import WalletFundMenu from '@/app/[locale]/(platform)/_components/wallet-modal/WalletFundMenu'
import WalletReceiveView from '@/app/[locale]/(platform)/_components/wallet-modal/WalletReceiveView'
import WalletSendForm from '@/app/[locale]/(platform)/_components/wallet-modal/WalletSendForm'
import WalletSuccessStep from '@/app/[locale]/(platform)/_components/wallet-modal/WalletSuccessStep'
import WalletTokenList from '@/app/[locale]/(platform)/_components/wallet-modal/WalletTokenList'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useLiFiQuote } from '@/hooks/useLiFiQuote'
import { useLiFiWalletTokens } from '@/hooks/useLiFiWalletTokens'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

export type { WalletDepositModalProps, WalletWithdrawModalProps }

export function WalletDepositModal(props: WalletDepositModalProps) {
  const {
    open,
    onOpenChange,
    isMobile,
    walletAddress,
    walletEoaAddress,
    siteName,
    meldUrl,
    hasDeployedDepositWallet,
    view,
    onViewChange,
    onBuy,
    depositWalletBalance,
    isDepositWalletBalanceLoading = false,
    walletBalance,
    isBalanceLoading = false,
  } = props

  const [copied, setCopied] = useState(false)
  const site = useSiteIdentity()
  const siteLabel = siteName ?? site.name
  const tokensQueryEnabled = open && (view === 'wallets' || view === 'amount' || view === 'confirm')
  const { items: walletTokenItems, isLoadingTokens } = useLiFiWalletTokens(walletEoaAddress, { enabled: tokensQueryEnabled })
  const [preferredSelectedTokenId, setPreferredSelectedTokenId] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [confirmRefreshIndex, setConfirmRefreshIndex] = useState(0)
  const formattedDepositWalletBalance = depositWalletBalance && depositWalletBalance !== ''
    ? depositWalletBalance
    : '0.00'
  const balanceDisplay = isDepositWalletBalanceLoading
    ? (
        <span className="inline-flex align-middle">
          <span className="h-3 w-12 animate-pulse rounded-md bg-accent" />
        </span>
      )
    : (
        <>
          $
          {formattedDepositWalletBalance}
        </>
      )

  const selectedTokenId = getSelectedWalletTokenId(walletTokenItems, preferredSelectedTokenId)
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
          disabledReceive={!hasDeployedDepositWallet}
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
              onSelect={setPreferredSelectedTokenId}
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
      setTimeout(setCopied, 1200, false)
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
                      <ChevronLeftIcon />
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
                    <ChevronLeftIcon />
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
    pendingWithdrawals = [],
  } = props
  const site = useSiteIdentity()
  const siteLabel = siteName ?? site.name

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
      pendingWithdrawals={pendingWithdrawals}
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
              {siteLabel}
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
            {siteLabel}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
