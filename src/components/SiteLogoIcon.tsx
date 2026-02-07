import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SiteLogoIconProps {
  logoSvg: string
  logoImageUrl?: string | null
  className?: string
  svgClassName?: string
  imageClassName?: string
  alt?: string
  size?: number
}

export default function SiteLogoIcon({
  logoSvg,
  logoImageUrl,
  className,
  svgClassName,
  imageClassName,
  alt = '',
  size = 24,
}: SiteLogoIconProps) {
  if (logoImageUrl) {
    return (
      <span className={className}>
        <Image
          src={logoImageUrl}
          alt={alt}
          width={size}
          height={size}
          className={cn('size-full object-contain', imageClassName)}
          unoptimized
        />
      </span>
    )
  }

  return (
    <span
      className={cn(className, svgClassName)}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  )
}
