'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { ThemeSiteLogoMode } from '@/lib/theme-site-identity'
import { ImageUp } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, sanitizeSvg } from '@/lib/utils'
import SettingsAccordionSection from './SettingsAccordionSection'

interface BrandIdentitySectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  siteName: string
  setSiteName: Dispatch<SetStateAction<string>>
  siteDescription: string
  setSiteDescription: Dispatch<SetStateAction<string>>
  logoMode: ThemeSiteLogoMode
  setLogoMode: Dispatch<SetStateAction<ThemeSiteLogoMode>>
  logoSvg: string
  setLogoSvg: Dispatch<SetStateAction<string>>
  logoImagePath: string
  setLogoImagePath: Dispatch<SetStateAction<string>>
  selectedLogoFile: File | null
  setSelectedLogoFile: Dispatch<SetStateAction<File | null>>
  logoPreviewUrl: string | null
  setLogoPreviewUrl: Dispatch<SetStateAction<string | null>>
  pwaIcon192PreviewUrl: string | null
  setPwaIcon192PreviewUrl: Dispatch<SetStateAction<string | null>>
  pwaIcon512PreviewUrl: string | null
  setPwaIcon512PreviewUrl: Dispatch<SetStateAction<string | null>>
  imagePreview: string | null
  svgPreviewUrl: string
  sanitizedLogoSvg: string
  pwaIcon192Preview: string
  pwaIcon512Preview: string
  initialLogoMode: ThemeSiteLogoMode
}

function BrandIdentitySection({
  isPending,
  openSections,
  onToggleSection,
  siteName,
  setSiteName,
  siteDescription,
  setSiteDescription,
  logoMode: _logoMode,
  setLogoMode,
  logoSvg: _logoSvg,
  setLogoSvg,
  logoImagePath: _logoImagePath,
  setLogoImagePath,
  selectedLogoFile,
  setSelectedLogoFile,
  logoPreviewUrl,
  setLogoPreviewUrl,
  pwaIcon192PreviewUrl,
  setPwaIcon192PreviewUrl,
  pwaIcon512PreviewUrl,
  setPwaIcon512PreviewUrl,
  imagePreview,
  svgPreviewUrl,
  sanitizedLogoSvg,
  pwaIcon192Preview,
  pwaIcon512Preview,
  initialLogoMode,
}: BrandIdentitySectionProps) {
  const t = useExtracted()

  const showImagePreview = Boolean(imagePreview)
  const showSvgPreview = !showImagePreview && Boolean(sanitizedLogoSvg.trim())

  return (
    <SettingsAccordionSection
      value="brand-identity"
      isOpen={openSections.includes('brand-identity')}
      onToggle={onToggleSection}
      header={<h3 className="text-base font-medium">{t('Brand identity')}</h3>}
    >
      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
          <div className="grid gap-3">
            <Label>{t('Logo icon')}</Label>
            <div className="grid gap-2">
              <Input
                id="theme-logo-file"
                type="file"
                name="logo_image"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={isPending}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (logoPreviewUrl) {
                    URL.revokeObjectURL(logoPreviewUrl)
                  }

                  setSelectedLogoFile(file)

                  if (file) {
                    setLogoPreviewUrl(URL.createObjectURL(file))
                    if (file.type === 'image/svg+xml') {
                      setLogoMode('svg')
                      setLogoImagePath('')
                      void file.text().then((text) => {
                        setLogoSvg(sanitizeSvg(text))
                      })
                    }
                    else {
                      setLogoMode('image')
                    }
                  }
                  else {
                    setLogoPreviewUrl(null)
                    setLogoMode(initialLogoMode)
                  }
                }}
              />
              <label
                htmlFor="theme-logo-file"
                className={cn(
                  `
                    group relative flex size-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                    border border-dashed border-border bg-muted/20 text-muted-foreground transition
                    hover:border-primary/60
                  `,
                  { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
                )}
              >
                <span className={`
                  pointer-events-none absolute inset-0 bg-foreground/0 transition
                  group-hover:bg-foreground/5
                `}
                />
                {imagePreview && (
                  <Image
                    src={imagePreview}
                    alt={t('Platform logo')}
                    fill
                    sizes="160px"
                    className="object-contain"
                    unoptimized
                  />
                )}
                {!showImagePreview && showSvgPreview && (
                  <Image
                    src={svgPreviewUrl}
                    alt={t('Platform logo')}
                    fill
                    sizes="160px"
                    className="object-contain"
                    unoptimized
                  />
                )}
                <ImageUp
                  className={cn(
                    `
                      pointer-events-none absolute top-1/2 left-1/2 z-10 size-7 -translate-1/2 text-foreground/70
                      opacity-0 transition
                      group-hover:opacity-100
                    `,
                  )}
                />
                <span
                  className={`
                    pointer-events-none absolute bottom-2 left-1/2 z-10 w-30 -translate-x-1/2 rounded-md
                    bg-background/80 px-2 py-1 text-center text-2xs leading-tight font-medium text-muted-foreground
                    opacity-0 transition
                    group-hover:opacity-100
                  `}
                >
                  {t('SVG, PNG, JPG or WebP')}
                </span>
              </label>
            </div>
            {selectedLogoFile && (
              <p className="text-xs text-muted-foreground">
                {t('Selected file:')}
                {' '}
                {selectedLogoFile.name}
              </p>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="theme-site-name">{t('Company name')}</Label>
              <Input
                id="theme-site-name"
                name="site_name"
                maxLength={80}
                value={siteName}
                onChange={event => setSiteName(event.target.value)}
                disabled={isPending}
                placeholder={t('Your company name')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-site-description">{t('Company description')}</Label>
              <Input
                id="theme-site-description"
                name="site_description"
                maxLength={180}
                value={siteDescription}
                onChange={event => setSiteDescription(event.target.value)}
                disabled={isPending}
                placeholder={t('Short description used in metadata and wallet dialogs')}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/50 pt-6">
          <h4 className="text-sm font-medium">{t('App install icon (PWA)')}</h4>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t('Icon 192x192')}</Label>
              <Input
                id="theme-pwa-icon-192-file"
                type="file"
                name="pwa_icon_192"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={isPending}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (pwaIcon192PreviewUrl) {
                    URL.revokeObjectURL(pwaIcon192PreviewUrl)
                  }
                  setPwaIcon192PreviewUrl(file ? URL.createObjectURL(file) : null)
                }}
              />
              <label
                htmlFor="theme-pwa-icon-192-file"
                className={cn(
                  `
                    group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                    border border-dashed border-border bg-muted/20 text-muted-foreground transition
                    hover:border-primary/60
                  `,
                  { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
                )}
              >
                <span className={`
                  pointer-events-none absolute inset-0 bg-foreground/0 transition
                  group-hover:bg-foreground/5
                `}
                />
                {pwaIcon192Preview && (
                  <Image
                    src={pwaIcon192Preview}
                    alt={t('PWA icon 192x192')}
                    fill
                    sizes="112px"
                    className="object-contain"
                    unoptimized
                  />
                )}
                <ImageUp
                  className={cn(
                    `
                      pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2 text-foreground/70
                      opacity-0 transition
                      group-hover:opacity-100
                    `,
                  )}
                />
                <span
                  className={`
                    pointer-events-none absolute bottom-1.5 left-1/2 z-10 w-20 -translate-x-1/2 rounded-md
                    bg-background/80 px-1.5 py-0.5 text-center text-2xs leading-tight font-medium text-muted-foreground
                    opacity-0 transition
                    group-hover:opacity-100
                  `}
                >
                  {t('PNG, JPG, WebP or SVG')}
                </span>
              </label>
            </div>

            <div className="grid gap-2">
              <Label>{t('Icon 512x512')}</Label>
              <Input
                id="theme-pwa-icon-512-file"
                type="file"
                name="pwa_icon_512"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={isPending}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (pwaIcon512PreviewUrl) {
                    URL.revokeObjectURL(pwaIcon512PreviewUrl)
                  }
                  setPwaIcon512PreviewUrl(file ? URL.createObjectURL(file) : null)
                }}
              />
              <label
                htmlFor="theme-pwa-icon-512-file"
                className={cn(
                  `
                    group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                    border border-dashed border-border bg-muted/20 text-muted-foreground transition
                    hover:border-primary/60
                  `,
                  { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
                )}
              >
                <span className={`
                  pointer-events-none absolute inset-0 bg-foreground/0 transition
                  group-hover:bg-foreground/5
                `}
                />
                {pwaIcon512Preview && (
                  <Image
                    src={pwaIcon512Preview}
                    alt={t('PWA icon 512x512')}
                    fill
                    sizes="112px"
                    className="object-contain"
                    unoptimized
                  />
                )}
                <ImageUp
                  className={cn(
                    `
                      pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2 text-foreground/70
                      opacity-0 transition
                      group-hover:opacity-100
                    `,
                  )}
                />
                <span
                  className={`
                    pointer-events-none absolute bottom-1.5 left-1/2 z-10 w-20 -translate-x-1/2 rounded-md
                    bg-background/80 px-1.5 py-0.5 text-center text-2xs leading-tight font-medium text-muted-foreground
                    opacity-0 transition
                    group-hover:opacity-100
                  `}
                >
                  {t('PNG, JPG, WebP or SVG')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </SettingsAccordionSection>
  )
}

export default BrandIdentitySection
