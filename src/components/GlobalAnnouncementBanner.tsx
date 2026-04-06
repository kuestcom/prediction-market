'use client'

import type { CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { isCustomJavascriptCodeEnabledOnPathname } from '@/lib/custom-javascript-code'

interface GlobalAnnouncementBannerProps {
  locale: string
  message: string
  linkUrl: string
  disabledOn: CustomJavascriptCodeDisablePage[]
}

function isExternalHttpUrl(value: string) {
  return value.startsWith('https://') || value.startsWith('http://')
}

function stripLocalePrefix(pathname: string | null, locale: string) {
  if (!pathname) {
    return pathname
  }

  const localePrefix = `/${locale}`
  if (pathname === localePrefix) {
    return '/'
  }

  if (pathname.startsWith(`${localePrefix}/`)) {
    return pathname.slice(localePrefix.length)
  }

  return pathname
}

export default function GlobalAnnouncementBanner({
  locale,
  message,
  linkUrl,
  disabledOn,
}: GlobalAnnouncementBannerProps) {
  const pathname = usePathname()
  const localizedPathname = useMemo(() => stripLocalePrefix(pathname, locale), [locale, pathname])
  const hasMessage = message.trim().length > 0
  const isEnabled = isCustomJavascriptCodeEnabledOnPathname({ disabledOn }, localizedPathname)

  if (!hasMessage || !isEnabled) {
    return null
  }

  const content = (
    <div className="w-full bg-primary text-primary-foreground">
      <div className="container py-2 text-center text-xs font-semibold sm:text-sm">
        {message}
      </div>
    </div>
  )

  if (!linkUrl) {
    return content
  }

  const opensInNewTab = isExternalHttpUrl(linkUrl)

  return (
    <a
      href={linkUrl}
      className="block transition-opacity hover:opacity-95"
      target={opensInNewTab ? '_blank' : undefined}
      rel={opensInNewTab ? 'noopener noreferrer' : undefined}
    >
      {content}
    </a>
  )
}
