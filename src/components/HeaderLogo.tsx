'use client'

import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { Link } from '@/i18n/navigation'

export default function HeaderLogo() {
  const site = useSiteIdentity()
  const { updateFilters } = useFilters()

  return (
    <Link
      href="/"
      onClick={() => {
        updateFilters({ tag: 'trending', mainTag: 'trending' })
      }}
      className={`
        flex h-10 shrink-0 items-center gap-2 text-2xl font-medium text-foreground transition-opacity
        hover:opacity-80
      `}
    >
      <SiteLogoIcon
        logoSvg={site.logoSvg}
        logoImageUrl={site.logoImageUrl}
        alt={`${site.name} logo`}
        className="size-[1em] text-current [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
        imageClassName="size-[1em] object-contain"
        size={32}
      />
      <span>{site.name}</span>
    </Link>
  )
}
