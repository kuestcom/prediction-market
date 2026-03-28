import { getExtracted, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import AdminCategoriesTable from '@/app/[locale]/admin/categories/_components/AdminCategoriesTable'
import { Skeleton } from '@/components/ui/skeleton'

function AdminCategoriesTableFallback() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full sm:max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="space-y-3 rounded-md border p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

export default async function AdminCategoriesPage({ params }: PageProps<'/[locale]/admin/categories'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Categories')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage which tags appear as main categories and control their visibility across the site.')}
        </p>
      </div>
      <div className="min-w-0">
        <Suspense fallback={<AdminCategoriesTableFallback />}>
          <AdminCategoriesTable />
        </Suspense>
      </div>
    </section>
  )
}
