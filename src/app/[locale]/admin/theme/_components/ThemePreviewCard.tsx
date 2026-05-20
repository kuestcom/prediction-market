'use client'

import type { ThemeOverrides } from '@/lib/theme'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { buildPreviewStyle } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { cn } from '@/lib/utils'

function ThemePreviewCard({
  presetId,
  isDark,
  overrides,
  radius,
  siteName,
  logoSvg,
  logoImageUrl,
}: {
  presetId: string
  isDark: boolean
  overrides: ThemeOverrides
  radius: string | null
  siteName: string
  logoSvg: string
  logoImageUrl: string | null
}) {
  const t = useExtracted()
  const style = useMemo(() => buildPreviewStyle(overrides, radius), [overrides, radius])

  return (
    <div
      data-theme-preset={presetId}
      data-theme-mode={isDark ? 'dark' : 'light'}
      style={style}
      className="grid gap-4 rounded-lg border border-border bg-background p-4 text-foreground"
    >
      <div className="flex items-center gap-2">
        <SiteLogoIcon
          logoSvg={logoSvg}
          logoImageUrl={logoImageUrl}
          alt={t('{siteName} logo', { siteName })}
          className="size-[1em] text-foreground [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
          imageClassName="size-[1em] object-contain"
          size={20}
        />
        <span className="text-sm font-semibold">{siteName}</span>
      </div>
      <div className="rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">{t('Market card')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('This block previews background, card, and text colors.')}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex rounded-sm bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            {t('Primary')}
          </span>
          <span className={cn(`
            inline-flex rounded-sm bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground
          `)}
          >
            {t('Secondary')}
          </span>
          <span className="inline-flex rounded-sm bg-yes px-2 py-1 text-xs font-semibold text-white">
            {t('Yes')}
          </span>
          <span className="inline-flex rounded-sm bg-no px-2 py-1 text-xs font-semibold text-white">
            {t('No')}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">{t('Input')}</label>
            <input
              type="text"
              placeholder={t('Type here')}
              className={cn(`
                h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-none
                ring-offset-background outline-none
                focus-visible:ring-2 focus-visible:ring-ring
              `)}
            />
          </div>
          <div className="rounded-md border border-border bg-popover p-2 text-xs">
            <p className="font-medium text-foreground">{t('Popover')}</p>
            <p className="mt-0.5 text-muted-foreground">{t('Muted sample text')}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">{t('Chart palette')}</p>
        <div className="h-12 rounded-md bg-transparent px-1">
          <svg
            viewBox="0 0 120 48"
            preserveAspectRatio="none"
            className="h-12 w-full"
            aria-hidden="true"
          >
            <path
              d="M2 7 C 22 4, 38 10, 58 6 S 92 10, 118 7"
              stroke="var(--chart-1)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 16 C 22 13, 38 19, 58 15 S 92 19, 118 16"
              stroke="var(--chart-2)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 25 C 22 22, 38 28, 58 24 S 92 28, 118 25"
              stroke="var(--chart-3)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 34 C 22 31, 38 37, 58 33 S 92 37, 118 34"
              stroke="var(--chart-4)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 43 C 22 40, 38 46, 58 42 S 92 46, 118 43"
              stroke="var(--chart-5)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default ThemePreviewCard
