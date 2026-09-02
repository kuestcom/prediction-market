'use client'

import Image from 'next/image'

import { LIST_ROW_COLUMNS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi'
import { useLeaderboardTranslations } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTranslations'
import ProfileLink from '@/components/ProfileLink'
import { buildPublicProfilePath } from '@/lib/platform-routing'
import { cn } from '@/lib/utils'

interface PinnedEntryData {
  rank: number | string
  address: string
  username: string
  profileImage: string
  pnl?: number
  vol?: number
  medalSrc: string | null
  medalAlt: string
}

interface PinnedUserRowProps {
  pinnedEntry: PinnedEntryData
  pinnedProfitLabel: string
  pinnedVolumeLabel: string
  pinnedMobileLabel: string
  pinnedMobileClass: string
  profitColumnClass: string
  volumeColumnClass: string
}

export default function PinnedUserRow({
  pinnedEntry,
  pinnedProfitLabel,
  pinnedVolumeLabel,
  pinnedMobileLabel,
  pinnedMobileClass,
  profitColumnClass,
  volumeColumnClass,
}: PinnedUserRowProps) {
  const { translateMedalAlt } = useLeaderboardTranslations()
  const pinnedRowClassName = cn(
    `relative z-0 grid w-full ${LIST_ROW_COLUMNS} min-h-[70px] items-center gap-4 py-4 pr-2 pl-3 text-sm shadow-sm before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-0 before:-z-10 before:rounded-xl before:bg-muted before:content-[''] dark:before:bg-muted`,
  )

  return (
    <div className="sticky bottom-12 z-20 mt-4">
      <div className={pinnedRowClassName}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-5 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
            {pinnedEntry.rank}
          </span>
          <span className="h-8 w-px shrink-0 bg-border/80" aria-hidden="true" />
          <ProfileLink
            user={{
              image: pinnedEntry.profileImage,
              username: pinnedEntry.username,
              address: pinnedEntry.address,
            }}
            profileSlug={pinnedEntry.address || pinnedEntry.username}
            profileHref={
              pinnedEntry.address || pinnedEntry.username
                ? (buildPublicProfilePath(pinnedEntry.address || pinnedEntry.username) ?? undefined)
                : undefined
            }
            layout="inline"
            containerClassName="min-w-0 gap-3 text-base leading-tight [&_[data-avatar]]:h-10 [&_[data-avatar]]:w-10"
            avatarSize={40}
            avatarBadge={
              pinnedEntry.medalSrc ? (
                <span className="absolute -bottom-1.5 -left-2">
                  <Image
                    src={pinnedEntry.medalSrc}
                    alt={translateMedalAlt(pinnedEntry.medalAlt)}
                    width={24}
                    height={24}
                    className="size-7"
                  />
                </span>
              ) : null
            }
            usernameClassName="text-base font-semibold text-foreground underline-offset-2 hover:underline"
            usernameMaxWidthClassName="max-w-full md:max-w-[55ch]"
          />
        </div>
        <div className={cn(pinnedMobileClass, 'md:hidden')}>{pinnedMobileLabel}</div>
        <div className={cn(profitColumnClass, 'hidden md:block')}>{pinnedProfitLabel}</div>
        <div className={cn(volumeColumnClass, 'hidden md:block')}>{pinnedVolumeLabel}</div>
      </div>
    </div>
  )
}
