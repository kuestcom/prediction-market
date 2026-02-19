export default function EventCardSkeleton() {
  return (
    <div className="h-45 animate-pulse rounded-xl border bg-card p-4 shadow-md shadow-black/4">
      <div className="mb-3 flex items-start gap-2">
        <div className="size-10 rounded-sm bg-muted dark:bg-secondary"></div>
        <div className="flex-1 space-y-2">
          <div className="size-3/4 rounded-sm bg-muted dark:bg-secondary"></div>
          <div className="h-3 w-1/2 rounded-sm bg-muted dark:bg-secondary"></div>
        </div>
        <div className="h-12 w-14 rounded-sm bg-muted dark:bg-secondary"></div>
      </div>

      <div className="mt-6 mb-3 grid grid-cols-2 gap-2">
        <div className="h-12 rounded-sm bg-muted dark:bg-secondary"></div>
        <div className="h-12 rounded-sm bg-muted dark:bg-secondary"></div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-3 w-16 rounded-sm bg-muted dark:bg-secondary"></div>
        <div className="h-3 w-6 rounded-sm bg-muted dark:bg-secondary"></div>
      </div>
    </div>
  )
}
