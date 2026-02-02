import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex h-full flex-col gap-4 rounded-lg border bg-background p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>

          <div className="mt-auto flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
          </div>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-9 rounded-md" />
              <Skeleton className="h-7 w-9 rounded-md" />
              <Skeleton className="h-7 w-9 rounded-md" />
              <Skeleton className="h-7 w-11 rounded-md" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>

          <Skeleton className="mt-auto h-16 w-full rounded-md" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="relative">
          <div className="flex items-center gap-6 px-4 pt-4 sm:px-6">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="mt-3 h-px bg-border/80" />
        </div>

        <div className="space-y-4 px-4 pt-4 pb-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:w-105" />
            <Skeleton className="h-10 w-36" />
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-230">
              <div
                className={`
                  grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 border-b px-2 pb-3 text-xs uppercase
                `}
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16 justify-self-center" />
                <Skeleton className="h-4 w-14 justify-self-center" />
                <Skeleton className="h-4 w-14 justify-self-center" />
                <Skeleton className="h-4 w-14 justify-self-center" />
                <Skeleton className="h-4 w-12 justify-self-end" />
              </div>

              <div className="divide-y divide-border/60">
                {[0, 1].map(item => (
                  <div
                    key={item}
                    className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 px-2 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-5 rounded-sm" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16 justify-self-center" />
                    <Skeleton className="h-4 w-14 justify-self-center" />
                    <Skeleton className="h-4 w-14 justify-self-center" />
                    <div className="space-y-2 justify-self-center">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Skeleton className="h-9 w-20 rounded-lg" />
                      <Skeleton className="size-9 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 border-t px-2 py-4">
                <Skeleton className="h-4 w-16" />
                <div />
                <Skeleton className="h-4 w-14 justify-self-center" />
                <Skeleton className="h-4 w-14 justify-self-center" />
                <div className="space-y-2 justify-self-center">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
