import { setRequestLocale } from 'next-intl/server'
import AdminCategoriesTable from '@/app/[locale]/admin/categories/_components/AdminCategoriesTable'

export default async function AdminCategoriesPage({ params }: PageProps<'/[locale]/admin/categories'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Manage which tags appear as main categories and control their visibility across the site.
        </p>
      </div>
      <div className="min-w-0">
        <AdminCategoriesTable />
      </div>
    </section>
  )
}
