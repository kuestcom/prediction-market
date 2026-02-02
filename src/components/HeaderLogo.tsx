import type { Route } from 'next'
import Link from 'next/link'
import { svgLogo } from '@/lib/utils'

interface HeaderLogoProps {
  locale?: string
}

export default async function HeaderLogo({ locale }: HeaderLogoProps) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME
  const logoSvg = svgLogo()
  const href = !locale || locale === 'en' ? '/' : `/${locale}`

  return (
    <Link
      href={href as Route}
      className={`
        flex shrink-0 items-center gap-2 text-2xl font-bold text-foreground transition-opacity
        hover:opacity-80
      `}
    >
      <div
        className="size-[1em] text-current [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
        dangerouslySetInnerHTML={{ __html: logoSvg! }}
      />
      <span>{siteName}</span>
    </Link>
  )
}
