import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ProfileLinkSkeletonProps {
  showPosition?: boolean
  showDate?: boolean
  showChildren?: boolean
  showTrailing?: boolean
  usernameMaxWidthClassName?: string
  usernameMinWidthClassName?: string
  trailingWidthClassName?: string
}

export default function ProfileLinkSkeleton({
  showPosition = false,
  showDate = false,
  showChildren = false,
  showTrailing = false,
  usernameMaxWidthClassName,
  usernameMinWidthClassName = 'min-w-35',
  trailingWidthClassName = 'w-12',
}: ProfileLinkSkeletonProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border/30 px-3 py-2 last:border-b-0',
      )}
    >
      <div className="relative shrink-0">
        <Skeleton className="size-8 rounded-full" />
        {showPosition && (
          <Skeleton className="absolute top-0 -right-2 size-5 rounded-full" />
        )}
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          { 'justify-between': showTrailing },
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton
            className={cn(
              'h-3.5 max-w-60 flex-1',
              usernameMinWidthClassName,
              usernameMaxWidthClassName ?? 'max-w-32 lg:max-w-64',
            )}
          />
          {(showChildren || showDate) && <Skeleton className="h-3 w-14 shrink-0" />}
        </div>
        {showTrailing && (
          <Skeleton className={cn('h-4 shrink-0', trailingWidthClassName)} />
        )}
      </div>
    </div>
  )
}
