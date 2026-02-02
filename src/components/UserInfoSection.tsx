import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useClipboard } from '@/hooks/useClipboard'
import { truncateAddress } from '@/lib/formatters'
import { useUser } from '@/stores/useUser'

export default function UserInfoSection() {
  const user = useUser()
  const { copied, copy } = useClipboard()

  if (!user) {
    return <></>
  }

  const proxyWalletAddress = user.proxy_wallet_address!
  const displayUsername = user.username?.length > 12
    ? `${user.username.slice(0, 12)}...`
    : user.username

  const polygonscanUrl = `https://polygonscan.com/address/${proxyWalletAddress}`

  function handleCopyWallet() {
    void copy(proxyWalletAddress)
  }

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="shrink-0">
        <Image
          src={user.image}
          alt="User avatar"
          width={48}
          height={48}
          className={`
            aspect-square rounded-full object-cover object-center ring-2 ring-border/20 transition-all duration-200
            hover:ring-border/40
          `}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link
          href={`/@${user.username}`}
          className={`
            truncate text-base/tight font-semibold text-foreground underline-offset-2 transition-colors duration-200
            hover:underline
          `}
        >
          {displayUsername}
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            type="button"
            size="sm"
            onClick={handleCopyWallet}
            className="-ml-2 text-xs text-muted-foreground"
            title={copied ? 'Copied!' : 'Copy address'}
          >
            <span className="font-mono">
              {truncateAddress(proxyWalletAddress)}
            </span>
            {copied
              ? (
                  <CheckIcon
                    className="size-3.5 text-yes"
                    data-testid="check-icon"
                  />
                )
              : <CopyIcon className="size-3.5" data-testid="copy-icon" />}
          </Button>
          <a href={polygonscanUrl} target="_blank">
            <Button
              variant="ghost"
              type="button"
              size="sm"
              className="-ml-2 text-xs text-muted-foreground"
              title="See on polygonscan"
            >
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
