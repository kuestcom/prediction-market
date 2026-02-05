import type { ProfileLinkStats } from '@/lib/data-api/profile-link-stats'
import Image from 'next/image'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function colorFromSeed(seed: string, offset: number, minLight = 40, maxLight = 70) {
  const hash = hashString(`${seed}-${offset}`)
  const hue = hash % 360
  const saturation = 45 + (hash % 35)
  const lightness = minLight + (hash % (maxLight - minLight))
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function getAvatarSeedFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const filename = parsed.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.\w+$/, ''))
  }
  catch {
    return ''
  }
}

function buildMeshOverlayStyle(seed: string) {
  const baseColor = colorFromSeed(seed, 0, 45, 65)
  const gradientA = colorFromSeed(seed, 1, 35, 75)
  const gradientB = colorFromSeed(seed, 2, 30, 70)
  const gradientC = colorFromSeed(seed, 3, 25, 65)
  const gradientD = colorFromSeed(seed, 4, 40, 75)

  return {
    backgroundColor: baseColor,
    backgroundImage: `
      radial-gradient(at 66% 77%, ${gradientA} 0px, transparent 50%),
      radial-gradient(at 29% 97%, ${gradientB} 0px, transparent 50%),
      radial-gradient(at 99% 86%, ${gradientC} 0px, transparent 50%),
      radial-gradient(at 29% 88%, ${gradientD} 0px, transparent 50%)
    `,
    mixBlendMode: 'overlay' as const,
    opacity: 0.9,
  }
}

interface ProfileActivityTooltipCardProps {
  profile: {
    username: string
    avatarUrl: string
    href: string
    joinedAt?: string | null
  }
  stats: ProfileLinkStats | null
  isLoading?: boolean
}

function formatJoinedLabel(joinedAt?: string | null) {
  if (!joinedAt) {
    return null
  }

  const parsed = new Date(joinedAt)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return `Joined ${parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

function normalizeStatValue(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatStatValue(value?: number | string | null) {
  const resolvedValue = normalizeStatValue(value)
  if (resolvedValue == null) {
    return '-'
  }

  const absValue = Math.abs(resolvedValue)
  const million = 1_000_000
  const thousand = 1_000

  if (absValue >= million) {
    const scaled = absValue / million
    const formatted = scaled >= 10
      ? Math.round(scaled).toString()
      : scaled.toFixed(1).replace(/\.0$/, '')
    return `$${formatted}m`
  }

  if (absValue >= thousand) {
    const scaled = absValue / thousand
    const formatted = scaled >= 10
      ? Math.round(scaled).toString()
      : scaled.toFixed(1).replace(/\.0$/, '')
    return `$${formatted}k`
  }

  return `$${Math.round(absValue)}`
}

function formatSignedStatValue(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  if (value < 0) {
    return `-${formatStatValue(value)}`
  }

  return formatStatValue(value)
}

export default function ProfileActivityTooltipCard({
  profile,
  stats,
  isLoading = false,
}: ProfileActivityTooltipCardProps) {
  const profileHref = profile.href as any
  const joinedLabel = formatJoinedLabel(profile.joinedAt)
  const positionsValue = formatStatValue(stats?.positionsValue)
  const volumeValue = formatStatValue(stats?.volume)
  const profitLossNumber = typeof stats?.profitLoss === 'number' && Number.isFinite(stats.profitLoss)
    ? stats.profitLoss
    : null
  const profitLossRounded = profitLossNumber == null ? null : Math.round(profitLossNumber)
  const profitLossValue = formatSignedStatValue(profitLossRounded)
  const profitLossClassName = profitLossNumber == null
    ? 'text-foreground'
    : (profitLossRounded ?? 0) > 0
        ? 'text-yes'
        : (profitLossRounded ?? 0) < 0
            ? 'text-no'
            : 'text-foreground'
  const isVercelFallback = profile.avatarUrl.includes('avatar.vercel.sh')
  const avatarSeed = isVercelFallback ? (getAvatarSeedFromUrl(profile.avatarUrl) || profile.username) : ''
  const fallbackOverlayStyle = isVercelFallback ? buildMeshOverlayStyle(avatarSeed) : undefined

  return (
    <div className="w-64 rounded-lg border bg-secondary pb-3">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-muted">
          <Image
            src={profile.avatarUrl}
            alt={`${profile.username} avatar`}
            fill
            sizes="56px"
            className="object-cover"
          />
          {fallbackOverlayStyle && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={fallbackOverlayStyle}
            />
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={profileHref}
            className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-foreground"
            title={profile.username}
          >
            {profile.username}
          </Link>
          {joinedLabel && (
            <div className="text-xs text-muted-foreground">
              {joinedLabel}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {isLoading
          ? (
              <>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Skeleton className="mx-auto h-4 w-14" />
                    <Skeleton className="mx-auto h-3 w-16" />
                  </div>
                ))}
              </>
            )
          : (
              <>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {positionsValue}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Positions
                  </div>
                </div>
                <div className="space-y-1">
                  <div className={cn('text-sm font-semibold tabular-nums', profitLossClassName)}>
                    {profitLossValue}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Profit/loss
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {volumeValue}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Volume
                  </div>
                </div>
              </>
            )}
      </div>
    </div>
  )
}
