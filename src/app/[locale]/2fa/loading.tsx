import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="w-full max-w-md rounded-lg border p-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="mt-6 grid gap-6">
        <div className="flex items-center justify-center gap-3">
          <Skeleton className="size-12" />
          <Skeleton className="size-12" />
          <Skeleton className="size-12" />
          <Skeleton className="size-12" />
          <Skeleton className="size-12" />
          <Skeleton className="size-12" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
