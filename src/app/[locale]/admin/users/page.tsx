import { setRequestLocale } from 'next-intl/server'
import AdminUsersTable from '@/app/[locale]/admin/users/_components/AdminUsersTable'

export default async function AdminUsersPage({ params }: PageProps<'/[locale]/admin/users'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts and view user statistics.
        </p>
      </div>
      <div className="min-w-0">
        <AdminUsersTable />
      </div>
    </section>
  )
}
