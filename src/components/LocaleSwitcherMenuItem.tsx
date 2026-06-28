'use client'

import type { SupportedLocale } from '@/i18n/locales'
import { CheckIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useEffect, useState } from 'react'
import LocaleFlag from '@/components/LocaleFlag'
import {
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALE_LABELS, LOOP_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { stripLocalePrefix, withLocalePrefix } from '@/lib/locale-path'

function useLocaleCarousel() {
  const [isPending, setIsPending] = useState(false)
  const [enabledLocales, setEnabledLocales] = useState<SupportedLocale[] | null>(null)
  const [carouselState, setCarouselState] = useState({ index: 0, isSliding: true })
  const displayLocales = enabledLocales ?? SUPPORTED_LOCALES
  const loopedLocales = [
    ...displayLocales,
    displayLocales[0],
  ].filter(Boolean)
  const shouldAnimate = displayLocales.length > 1
  const carouselIndex = shouldAnimate
    ? Math.min(carouselState.index, displayLocales.length)
    : 0
  const isSliding = carouselState.isSliding
  const displayDurationMs = 1800
  const transitionDurationMs = 240

  useEffect(function fetchEnabledLocales() {
    let isActive = true

    async function loadEnabledLocales() {
      try {
        const response = await fetch('/api/locales')
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        if (!isActive || !Array.isArray(payload?.locales)) {
          return
        }
        const normalized = normalizeEnabledLocales(payload.locales)
        if (normalized.length > 0) {
          setEnabledLocales(normalized)
        }
      }
      catch (error) {
        console.error('Failed to load enabled locales', error)
      }
    }

    void loadEnabledLocales()

    return function cleanupFetchEnabledLocales() {
      isActive = false
    }
  }, [])

  useEffect(function runCarouselInterval() {
    if (!shouldAnimate) {
      return
    }

    const interval = window.setInterval(() => {
      setCarouselState(prev => ({
        index: prev.index >= displayLocales.length ? 1 : prev.index + 1,
        isSliding: true,
      }))
    }, displayDurationMs + transitionDurationMs)

    return function cleanupCarouselInterval() {
      window.clearInterval(interval)
    }
  }, [shouldAnimate, displayDurationMs, transitionDurationMs, displayLocales.length])

  function handleCarouselTransitionEnd() {
    setCarouselState((prev) => {
      if (prev.index < displayLocales.length) {
        return prev
      }

      return {
        index: 0,
        isSliding: false,
      }
    })
  }

  return { isPending, setIsPending, displayLocales, loopedLocales, shouldAnimate, carouselIndex, isSliding, handleCarouselTransitionEnd }
}

export default function LocaleSwitcherMenuItem() {
  const locale = useLocale()
  const { isPending, setIsPending, displayLocales, loopedLocales, shouldAnimate, carouselIndex, isSliding, handleCarouselTransitionEnd } = useLocaleCarousel()
  const itemHeightRem = 1.25

  function handleValueChange(nextLocale: string) {
    const resolvedLocale = nextLocale as SupportedLocale

    if (resolvedLocale === locale || typeof window === 'undefined') {
      return
    }

    const currentPathname = stripLocalePrefix(window.location.pathname)
    const targetPathname = withLocalePrefix(currentPathname, resolvedLocale)
    const targetUrl = `${targetPathname}${window.location.search}${window.location.hash}`

    setIsPending(true)
    window.location.replace(targetUrl)
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={isPending} className="py-2 text-sm font-semibold text-muted-foreground">
        <span className="sr-only">Language</span>
        <span className="h-5 overflow-hidden text-sm">
          <span
            className="block transition-transform duration-200 ease-in-out"
            style={{
              transform: `translateY(-${carouselIndex * itemHeightRem}rem)`,
              transition: isSliding && shouldAnimate ? undefined : 'none',
            }}
            onTransitionEnd={handleCarouselTransitionEnd}
          >
            {loopedLocales.map((option, index) => (
              <span key={`${option}-${index}`} className="flex h-5 items-center gap-1.5 leading-5">
                <LocaleFlag locale={option} />
                <span>{LOOP_LABELS[option] ?? option.toUpperCase()}</span>
              </span>
            ))}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent sideOffset={-30}>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={handleValueChange}
          >
            {displayLocales.map(option => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                className="group flex items-center gap-1.5 pr-7 pl-2 text-sm font-semibold [&>span:first-child]:hidden"
              >
                <span className="flex flex-1 items-center gap-2 font-medium">
                  <LocaleFlag locale={option} />
                  <span>{LOCALE_LABELS[option] ?? option.toUpperCase()}</span>
                </span>
                <CheckIcon className="ml-auto size-4 text-primary opacity-0 group-data-[state=checked]:opacity-100" />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}
