import type { ReactNode } from 'react'
import {
  ExternalLinkIcon,
  WalletIcon,
} from 'lucide-react'
import { formatWalletModalAddress } from '@/app/[locale]/(platform)/_components/wallet-modal/utils'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { POLYGON_SCAN_BASE } from '@/lib/network'

interface WalletTransferSummaryProps {
  walletEoaAddress?: string | null
  walletAddress?: string | null
  siteLabel: string
  showExternalLinks?: boolean
  showDestinationAddress?: boolean
  extraRows?: ReactNode
}

export default function WalletTransferSummary({
  walletEoaAddress,
  walletAddress,
  siteLabel,
  showExternalLinks = false,
  showDestinationAddress = false,
  extraRows,
}: WalletTransferSummaryProps) {
  const walletEoaLabel = formatWalletModalAddress(walletEoaAddress)
  const walletLabel = showDestinationAddress ? formatWalletModalAddress(walletAddress) : null
  const site = useSiteIdentity()

  return (
    <div className="rounded-lg border">
      <WalletTransferSummaryRow
        label="Source"
        value={(
          <>
            <WalletIcon className="size-4" />
            Wallet
            {walletEoaLabel ? ` (${walletEoaLabel})` : ''}
            {showExternalLinks && walletEoaAddress && (
              <ExplorerLink
                address={walletEoaAddress}
                label="View wallet on Polygonscan"
              />
            )}
          </>
        )}
      />
      <WalletTransferSummaryDivider />
      <WalletTransferSummaryRow
        label="Destination"
        value={(
          <>
            <SiteLogoIcon
              logoSvg={site.logoSvg}
              logoImageUrl={site.logoImageUrl}
              alt={`${siteLabel} logo`}
              className="size-4 text-current [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
              imageClassName="size-[1em] object-contain"
              size={16}
            />
            {siteLabel}
            {' '}
            Wallet
            {walletLabel ? ` (${walletLabel})` : ''}
            {showExternalLinks && walletAddress && (
              <ExplorerLink
                address={walletAddress}
                label="View wallet on Polygonscan"
              />
            )}
          </>
        )}
      />
      {extraRows}
    </div>
  )
}

export function WalletTransferSummaryDivider() {
  return <div className="mx-auto h-px w-[90%] bg-border/60" />
}

export function WalletTransferSummaryRow({
  label,
  value,
}: {
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div className="px-4 py-1.5 text-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="flex items-center gap-2 font-semibold text-foreground">
          {value}
        </span>
      </div>
    </div>
  )
}

function ExplorerLink({
  address,
  label,
}: {
  address: string
  label: string
}) {
  return (
    <a
      href={`${POLYGON_SCAN_BASE}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex"
      aria-label={label}
    >
      <ExternalLinkIcon className="size-3" />
    </a>
  )
}
