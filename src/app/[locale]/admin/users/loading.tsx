'use client'

import { useExtracted } from 'next-intl'
import { DataTableSkeleton } from '@/app/[locale]/admin/_components/DataTableSkeleton'

export default function Loading() {
  const t = useExtracted()

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">{t('Users')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('Manage user accounts and view user statistics.')}
        </p>
      </div>
      <div className="min-w-0">
        <DataTableSkeleton />
      </div>
    </section>
  )
}
