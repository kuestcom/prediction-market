'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'

function WalletAddressCard({
  walletAddress,
  onCopy,
  copied,
  label = 'Deposit Wallet',
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
          {copied ? <CheckIcon className="size-4 text-primary" /> : <CopyIcon className="size-4 text-muted-foreground" />}
        </span>
      </div>
    </div>
  )
}

export default WalletAddressCard
