'use client'

import { useExtracted } from 'next-intl'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import WalletAddressCard from '@/app/[locale]/(platform)/_components/wallet-modal/WalletAddressCard'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

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
  const site = useSiteIdentity()
  const siteLabel = siteName ?? site.name
  const t = useExtracted()

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
              : <p className="text-sm">{t('Deposit Wallet not ready yet.')}</p>}
          </div>
        </div>
      </div>
      <WalletAddressCard
        walletAddress={walletAddress}
        onCopy={onCopy}
        copied={copied}
        label={t('Deposit Wallet')}
      />
    </div>
  )
}

export default WalletReceiveView
