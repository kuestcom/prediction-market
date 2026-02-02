export default function EventRelatedSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-start gap-2 p-2">
        <div className="size-8 rounded-sm bg-muted"></div>
        <div className="flex flex-1 items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded-sm bg-muted"></div>
            <div className="h-4 w-1/2 rounded-sm bg-muted"></div>
          </div>
          <div className="h-4 w-10 rounded-sm bg-muted"></div>
        </div>
      </div>
    </div>
  )
}
