import { Skeleton } from '@/components/ui/skeleton'

export function TwoFactorSetupSkeleton() {
  return (
    <div className="rounded-lg border p-6">
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />

        <div className="space-y-2">
          <div className="flex">
            <Skeleton className="mr-2 h-5 w-3" />
            <Skeleton className="h-5 w-40 lg:w-80" />
          </div>
          <div className="flex">
            <Skeleton className="mr-2 h-5 w-3" />
            <Skeleton className="h-5 w-32 lg:w-64" />
          </div>
          <div className="flex">
            <Skeleton className="mr-2 h-5 w-3" />
            <Skeleton className="h-5 w-36 lg:w-72" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="flex justify-center">
          <Skeleton className="size-32" />
        </div>

        <div className="text-center">
          <Skeleton className="mx-auto h-4 w-full" />
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-12 w-10" />
            <Skeleton className="h-12 w-10" />
            <Skeleton className="h-12 w-10" />
            <Skeleton className="h-12 w-10" />
            <Skeleton className="h-12 w-10" />
            <Skeleton className="h-12 w-10" />
          </div>

          <div className="text-center">
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="ms-auto">
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  )
}
