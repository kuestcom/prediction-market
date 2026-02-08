import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
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
        <HeaderLogo />
        <span>Admin</span>
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
          <HeaderDropdownUserMenuAuth />
        </div>
      </div>
    </header>
  )
}
