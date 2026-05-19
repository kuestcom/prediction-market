'use client'

import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import type { LeaderboardEntry } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTypes'
import Image from 'next/image'
import {
  formatSignedCurrency,
  formatVolumeCurrency,
  getMedalProps,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFormatters'
import ProfileLink from '@/components/ProfileLink'
import { buildPublicProfilePath } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

interface LeaderboardListRowProps {
  entry: LeaderboardEntry
  index: number
  filters: LeaderboardFilters
  rowClassName: string
  profitColumnClass: string
  volumeColumnClass: string
}

export default function LeaderboardListRow({
  entry,
  index,
  filters,
  rowClassName,
  profitColumnClass,
  volumeColumnClass,
}: LeaderboardListRowProps) {
  const rank = entry.rank ?? index + 1
  const address = entry.proxyWallet || ''
  const rawUsername = entry.userName || entry.xUsername || ''
  const isWalletAlias = rawUsername.startsWith('0x') && rawUsername.includes('...')
  const username = (isWalletAlias && address ? address : rawUsername) || address || ''
  const profileSlug = address || username
  const profileHref = profileSlug ? buildPublicProfilePath(profileSlug) ?? undefined : undefined
  const profitValue = Number(entry.pnl ?? 0)
  const volumeValue = Number(entry.vol ?? 0)
  const profitLabel = formatSignedCurrency(profitValue)
  const volumeLabel = formatVolumeCurrency(volumeValue)
  const mobileValueLabel = filters.order === 'profit' ? profitLabel : volumeLabel
  const mobileValueClass = filters.order === 'profit' ? profitColumnClass : volumeColumnClass
  const rankNumber = Number(rank)
  const { medalSrc, medalAlt } = getMedalProps(rankNumber)

  return (
    <div key={`${address || username}-${rank}`} className={rowClassName}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
          {rank}
        </span>
        <ProfileLink
          user={{
            image: entry.profileImage || '',
            username,
            address,
          }}
          profileSlug={profileSlug}
          profileHref={profileHref}
          layout="inline"
          containerClassName="min-w-0 gap-3 text-base leading-tight [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
          avatarSize={40}
          avatarBadge={medalSrc
            ? (
                <span className="absolute -bottom-1.5 -left-2">
                  <Image src={medalSrc} alt={medalAlt} width={24} height={24} className="size-7" />
                </span>
              )
            : null}
          usernameClassName="text-base font-semibold text-foreground underline-offset-2 hover:underline"
          usernameMaxWidthClassName="max-w-full md:max-w-[55ch]"
        />
      </div>
      <div className={cn(mobileValueClass, 'md:hidden')}>{mobileValueLabel}</div>
      <div className={cn(profitColumnClass, 'hidden md:block')}>{profitLabel}</div>
      <div className={cn(volumeColumnClass, 'hidden md:block')}>{volumeLabel}</div>
    </div>
  )
}
