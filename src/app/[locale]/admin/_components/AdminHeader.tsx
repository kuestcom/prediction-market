import AdminHeaderActions from '@/app/[locale]/admin/_components/AdminHeaderActions'
import HeaderLogo from '@/components/HeaderLogo'

export default async function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background">
      <div
        className={`
          relative z-50 container mx-auto flex min-h-15 w-full items-center gap-4 py-3 pb-1
          md:min-h-17 md:pb-2
        `}
      >
        <HeaderLogo labelSuffix="Admin" />
        <AdminHeaderActions />
      </div>
    </header>
  )
}
