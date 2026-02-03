import HeaderHowItWorks from '@/app/[locale]/(platform)/_components/HeaderHowItWorks'
import HeaderMenu from '@/app/[locale]/(platform)/_components/HeaderMenu'
import HeaderSearch from '@/app/[locale]/(platform)/_components/HeaderSearch'
import HeaderLogo from '@/components/HeaderLogo'

export default async function Header() {
  return (
    <header className="sticky top-0 z-50 my-2 bg-background">
      <div className="container flex h-14 items-center gap-4">
        <HeaderLogo />
        <div className="flex flex-1 items-center gap-2">
          <HeaderSearch />
          <HeaderHowItWorks />
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
          <HeaderMenu />
        </div>
      </div>
    </header>
  )
}
