import HeaderMenu from '@/app/[locale]/(platform)/_components/HeaderMenu'
import HeaderSearch from '@/app/[locale]/(platform)/_components/HeaderSearch'
import HowItWorksDeferred from '@/app/[locale]/(platform)/_components/HowItWorksDeferred'
import HeaderLogo from '@/components/HeaderLogo'

export default async function Header() {
  return (
    <header className="sticky top-0 z-30 bg-background">
      <div
        className={`
          relative z-50 container mx-auto flex min-h-15 w-full items-center justify-between gap-4 py-3 pb-1
          md:min-h-17 md:pb-2
        `}
      >
        <HeaderLogo />
        <div className="hidden w-full items-center gap-2 lg:flex">
          <HeaderSearch />
          <HowItWorksDeferred />
        </div>
        <div className="min-w-0 shrink md:min-w-fit md:shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
