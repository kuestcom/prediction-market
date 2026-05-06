import type { ImageProps } from 'next/image'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function isEventMarketIconUrl(url: string | null | undefined) {
  const normalizedUrl = url?.trim() ?? ''
  return normalizedUrl.includes('/events/icons/') || normalizedUrl.includes('/markets/icons/')
}

interface EventIconImageProps extends Omit<ImageProps, 'className' | 'fill' | 'height' | 'width'> {
  containerClassName?: string
  imageClassName?: string
}

export default function EventIconImage({
  src,
  alt,
  sizes = '100vw',
  containerClassName,
  imageClassName,
  ...props
}: EventIconImageProps) {
  if (typeof src === 'string' && !src.trim()) {
    return null
  }

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      <Image
        {...props}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn('shrink-0 object-cover object-center', imageClassName)}
      />
    </div>
  )
}
