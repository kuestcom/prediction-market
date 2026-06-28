'use client'

import type { ImageProps } from 'next/image'
import type { SupportedLocale } from '@/i18n/locales'
import Image from 'next/image'
import { getLocaleFlagSrc } from '@/i18n/locales'
import { cn } from '@/lib/utils'

interface LocaleFlagProps extends Omit<ImageProps, 'alt' | 'height' | 'src' | 'width'> {
  locale: SupportedLocale
}

export default function LocaleFlag({
  locale,
  className,
  ...props
}: LocaleFlagProps) {
  return (
    <Image
      src={getLocaleFlagSrc(locale)}
      alt=""
      width={16}
      height={16}
      aria-hidden="true"
      className={cn('size-4 shrink-0 rounded-full object-cover', className)}
      {...props}
    />
  )
}
