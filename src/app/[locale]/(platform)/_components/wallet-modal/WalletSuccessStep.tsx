'use client'

import { CheckIcon, InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'

import type { LiFiWalletTokenItem } from '@/hooks/useLiFiWalletTokens'

import WalletTransferSummary from '@/app/[locale]/(platform)/_components/wallet-modal/WalletTransferSummary'
import { Button } from '@/components/ui/button'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { formatDisplayAmount } from '@/lib/amount-input'

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
  quote?: { toAmountDisplay: string | null; gasUsdDisplay: string | null } | null
  onClose: () => void
  onNewDeposit: () => void
}) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const supportUrl = site.supportUrl
  const supportIsEmail = supportUrl?.startsWith('mailto:') ?? false
  const formattedAmount = formatDisplayAmount(amountValue)
  const displayAmount = formattedAmount && formattedAmount.trim() !== '' ? formattedAmount : '0.00'
  const sendSymbol = selectedToken?.symbol ?? t('Token')
  const sendIcon = selectedToken?.icon ?? '/images/deposit/transfer/polygon_dark.png'
  const chainIcon = selectedToken?.chainIcon ?? '/images/deposit/transfer/polygon_dark.png'
  const receiveAmountDisplay = quote?.toAmountDisplay ?? '—'

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-20 rounded-full bg-emerald-500/25 blur-md" />
          <div className="relative flex size-14 items-center justify-center rounded-full bg-emerald-500">
            <CheckIcon className="size-7 text-background" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{t('Deposit successful')}</p>
          <p className="text-sm text-muted-foreground">{t('Your funds were successfully deposited.')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('Fill status')}</span>
              <span className="font-semibold text-emerald-500">{t('Successful')}</span>
            </div>
          </div>
          <div className="mx-auto h-px w-[90%] bg-border/60" />
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('Total time')}</span>
              <span className="font-semibold text-foreground">{t('1 second')}</span>
            </div>
          </div>
        </div>

        <WalletTransferSummary
          walletEoaAddress={walletEoaAddress}
          walletAddress={walletAddress}
          siteLabel={siteLabel}
          showDestinationAddress
          showExternalLinks
        />

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('You send')}</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="relative">
                  <Image src={sendIcon} alt={sendSymbol} width={18} height={18} className="rounded-full" unoptimized />
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                    <Image
                      src={chainIcon}
                      alt={selectedToken?.network ?? t('Chain')}
                      width={10}
                      height={10}
                      className="rounded-full"
                      unoptimized={chainIcon.startsWith('http')}
                    />
                  </span>
                </span>
                {displayAmount} {sendSymbol}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-1.5 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t('You receive')}</span>
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
          <InfoIcon className="size-4 text-muted-foreground" />
          <span>
            {t.rich('Experiencing problems? <link>Get help</link>.', {
              link: (chunks) => (
                <a
                  href={supportUrl}
                  target={supportIsEmail ? undefined : '_blank'}
                  rel={supportIsEmail ? undefined : 'noreferrer'}
                  className="underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" className="h-11 bg-muted text-foreground hover:bg-muted/80" onClick={onClose}>
          {t('Close')}
        </Button>
        <Button type="button" className="h-11" onClick={onNewDeposit}>
          {t('New Deposit')}
        </Button>
      </div>
    </div>
  )
}

export default WalletSuccessStep
