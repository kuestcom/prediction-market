import { Link } from '@/i18n/navigation'
import { svgLogo } from '@/lib/utils'

export default async function HeaderLogo() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME
  const logoSvg = svgLogo()

  return (
    <Link
      href="/"
      className={`
        flex h-10 shrink-0 items-center gap-2 text-2xl font-medium text-foreground transition-opacity
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
