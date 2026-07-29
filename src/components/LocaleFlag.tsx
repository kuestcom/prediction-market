'use client'

import type { ImageProps } from 'next/image'

import Image from 'next/image'

import type { SupportedLocale } from '@/i18n/locales'

import { getLocaleFlagSrc } from '@/i18n/locales'
import { cn } from '@/lib/utils'

interface LocaleFlagProps extends Omit<ImageProps, 'alt' | 'height' | 'src' | 'width'> {
  locale: SupportedLocale
}

export default function LocaleFlag({ locale, className, ...props }: LocaleFlagProps) {
  return (
    <Image
      src={getLocaleFlagSrc(locale)}
      alt=""
      width={18}
      height={12}
      aria-hidden="true"
      className={cn('h-3 w-[18px] shrink-0 rounded-[3px] object-cover [clip-path:inset(0_round_3px)]', className)}
      {...props}
    />
  )
}
