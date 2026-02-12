'use client'

import type { SupportedLocale } from '@/i18n/locales'
import { CheckIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import {
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALE_LABELS, LOOP_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'

export default function LocaleSwitcherMenuItem() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [enabledLocales, setEnabledLocales] = useState<SupportedLocale[] | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isSliding, setIsSliding] = useState(true)
  const displayLocales = enabledLocales ?? SUPPORTED_LOCALES
  const localeLabels = displayLocales.map(
    option => LOOP_LABELS[option] ?? option.toUpperCase(),
  )
  const loopedLabels = [
    ...localeLabels,
    localeLabels[0],
  ].filter(Boolean)
  const shouldAnimate = localeLabels.length > 1
  const displayDurationMs = 1800
  const transitionDurationMs = 240
  const itemHeightRem = 1.25

  useEffect(() => {
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

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!shouldAnimate) {
      return
    }

    const interval = window.setInterval(() => {
      setIsSliding(true)
      setCarouselIndex(prev => prev + 1)
    }, displayDurationMs + transitionDurationMs)

    return () => window.clearInterval(interval)
  }, [shouldAnimate, displayDurationMs, transitionDurationMs])

  useEffect(() => {
    setCarouselIndex(0)
    setIsSliding(true)
  }, [displayLocales.length])

  function handleCarouselTransitionEnd() {
    if (carouselIndex === localeLabels.length) {
      setIsSliding(false)
      setCarouselIndex(0)
    }
  }

  function handleValueChange(nextLocale: string) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- next-intl validates that params match the pathname.
        { pathname, params },
        { locale: nextLocale as SupportedLocale },
      )
    })
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
            {loopedLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="block h-5 leading-5">
                {label}
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
                <span className="flex-1 font-medium">
                  {LOCALE_LABELS[option] ?? option.toUpperCase()}
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
