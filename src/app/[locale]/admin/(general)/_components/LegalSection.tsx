'use client'

import { FileTextIcon, MapPinOffIcon, SearchIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'

import type { SupportedLocale } from '@/i18n/locales'
import type { TermsOfServiceTranslations } from '@/lib/terms-of-service'

import LocaleFlag from '@/components/LocaleFlag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/useIsMobile'
import { LOCALE_LABELS } from '@/i18n/locales'
import { GEOBLOCK_COUNTRY_OPTIONS } from '@/lib/geoblock-country-options'
import { TERMS_OF_SERVICE_CONTENT_MAX_LENGTH } from '@/lib/terms-of-service'
import { cn } from '@/lib/utils'

import SettingsAccordionSection from './SettingsAccordionSection'

interface LegalSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  enabledLocales: SupportedLocale[]
  termsOfServiceTranslations: TermsOfServiceTranslations
  onTermsOfServiceTranslationChange: (locale: SupportedLocale, content: string) => void
  blockedCountries: string[]
  onToggleBlockedCountry: (code: string, checked: boolean) => void
  onClearBlockedCountries: () => void
}

function LegalSection({
  isPending,
  openSections,
  onToggleSection,
  enabledLocales,
  termsOfServiceTranslations,
  onTermsOfServiceTranslationChange,
  blockedCountries,
  onToggleBlockedCountry,
  onClearBlockedCountries,
}: LegalSectionProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const [isBlockedCountriesDialogOpen, setIsBlockedCountriesDialogOpen] = useState(false)
  const [blockedCountrySearch, setBlockedCountrySearch] = useState('')
  const termsOfServiceLocales = enabledLocales.length > 0 ? enabledLocales : (['en'] as SupportedLocale[])
  const [selectedTermsOfServiceLocale, setSelectedTermsOfServiceLocale] = useState<SupportedLocale>(
    termsOfServiceLocales[0] ?? 'en',
  )
  const blockedCountryOptionsByCode = useMemo(
    () => new Map(GEOBLOCK_COUNTRY_OPTIONS.map((option) => [option.code, option])),
    [],
  )
  const selectedBlockedCountryOptions = useMemo(() => {
    return blockedCountries.map((code) => {
      return blockedCountryOptionsByCode.get(code) ?? { code, name: code }
    })
  }, [blockedCountries, blockedCountryOptionsByCode])
  const filteredBlockedCountryOptions = useMemo(() => {
    const normalizedSearch = blockedCountrySearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return GEOBLOCK_COUNTRY_OPTIONS
    }

    return GEOBLOCK_COUNTRY_OPTIONS.filter(
      (option) =>
        option.code.toLowerCase().includes(normalizedSearch) || option.name.toLowerCase().includes(normalizedSearch),
    )
  }, [blockedCountrySearch])

  function handleBlockedCountriesOpenChange(nextOpen: boolean) {
    setIsBlockedCountriesDialogOpen(nextOpen)
    if (!nextOpen) {
      setBlockedCountrySearch('')
    }
  }

  const blockedCountriesButtonLabel = blockedCountries.length > 0 ? t('Manage countries') : t('Select countries')

  const blockedCountriesDialogDescription = t(
    'Search and select the countries where users should not be able to access the platform. If none are selected, the site stays available for everyone.',
  )
  const blockedCountriesContent = (
    <div className="grid gap-4">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={blockedCountrySearch}
          onChange={(event) => setBlockedCountrySearch(event.target.value)}
          placeholder={t('Search by country or code')}
          className="pl-9"
        />
      </div>

      {selectedBlockedCountryOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          {selectedBlockedCountryOptions.map((option) => (
            <Badge key={option.code} variant="secondary" className="gap-1.5 pr-1">
              <span>{option.code}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-black/10"
                onClick={() => onToggleBlockedCountry(option.code, false)}
                aria-label={t('Remove blocked country')}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('No countries selected yet.')}</p>
      )}

      <div className="max-h-96 overflow-y-auto rounded-xl border border-border/60">
        <div className="divide-y divide-border/60">
          {filteredBlockedCountryOptions.map((option) => (
            <label
              key={option.code}
              htmlFor={`blocked-country-${option.code}`}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30',
                blockedCountries.includes(option.code) && 'bg-primary/5',
              )}
            >
              <div className="grid gap-1">
                <span className="text-sm font-medium">{option.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{option.code}</span>
              </div>
              <Checkbox
                id={`blocked-country-${option.code}`}
                checked={blockedCountries.includes(option.code)}
                onCheckedChange={(checked) => onToggleBlockedCountry(option.code, checked === true)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <SettingsAccordionSection
        value="terms-of-service"
        isOpen={openSections.includes('terms-of-service')}
        onToggle={onToggleSection}
        header={
          <h3 className="flex items-center gap-2 text-base font-medium">
            <FileTextIcon className="size-4 text-muted-foreground" />
            {t('Terms of Service')}
          </h3>
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="terms-of-service-locale" className="shrink-0">
              {t('Choose the language')}
            </Label>
            <div className="flex min-w-0 items-center gap-2 sm:w-40">
              <Select
                value={selectedTermsOfServiceLocale}
                disabled={isPending}
                onValueChange={(value) => {
                  if (value !== null && termsOfServiceLocales.includes(value as SupportedLocale)) {
                    setSelectedTermsOfServiceLocale(value as SupportedLocale)
                  }
                }}
              >
                <SelectTrigger id="terms-of-service-locale" className="w-40">
                  <span className="flex min-w-0 items-center gap-2">
                    <LocaleFlag locale={selectedTermsOfServiceLocale} />
                    <SelectValue className="min-w-0 truncate">
                      {LOCALE_LABELS[selectedTermsOfServiceLocale]}
                    </SelectValue>
                  </span>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="w-full">
                  {termsOfServiceLocales.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      <span className="flex items-center gap-2">
                        <LocaleFlag locale={locale} />
                        <span>{LOCALE_LABELS[locale]}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Textarea
              id={`terms-of-service-${selectedTermsOfServiceLocale}`}
              aria-label={`${LOCALE_LABELS[selectedTermsOfServiceLocale]} terms of service content`}
              value={termsOfServiceTranslations[selectedTermsOfServiceLocale]}
              disabled={isPending}
              maxLength={TERMS_OF_SERVICE_CONTENT_MAX_LENGTH}
              rows={14}
              className="max-h-[min(32rem,60vh)] min-h-64 resize-y overflow-y-auto font-mono text-sm leading-relaxed"
              onChange={(event) => onTermsOfServiceTranslationChange(selectedTermsOfServiceLocale, event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('Available variables')}: <code>{'{{siteName}}'}</code>, <code>{'{{siteNameUpper}}'}</code>,{' '}
              <code>{'{{siteUrl}}'}</code>. Use <code>#</code> for titles, <code>##</code> for topics, <code>-</code>{' '}
              for bullets, blank lines for paragraphs, and <code>**text**</code> for bold.
            </p>
          </div>
        </div>
      </SettingsAccordionSection>

      <SettingsAccordionSection
        value="geoblocking"
        isOpen={openSections.includes('geoblocking')}
        onToggle={onToggleSection}
        header={
          <h3 className="flex items-center gap-2 text-base font-medium">
            <MapPinOffIcon className="size-4 text-muted-foreground" />
            {t('Geoblocking')}
          </h3>
        }
      >
        <div className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <Label>{t('Blocked countries')}</Label>
            </div>

            {isMobile ? (
              <Drawer open={isBlockedCountriesDialogOpen} onOpenChange={handleBlockedCountriesOpenChange}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setIsBlockedCountriesDialogOpen(true)}
                >
                  {blockedCountriesButtonLabel}
                </Button>

                <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                  <div className="grid gap-4">
                    <DrawerHeader className="space-y-2 p-0 text-left">
                      <DrawerTitle>{t('Blocked countries')}</DrawerTitle>
                      <DrawerDescription>{blockedCountriesDialogDescription}</DrawerDescription>
                    </DrawerHeader>
                    {blockedCountriesContent}
                    <DrawerFooter className="mt-2 p-0">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={blockedCountries.length === 0}
                        onClick={onClearBlockedCountries}
                      >
                        {t('Clear all')}
                      </Button>
                      <Button type="button" onClick={() => setIsBlockedCountriesDialogOpen(false)}>
                        {t('Done')}
                      </Button>
                    </DrawerFooter>
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={isBlockedCountriesDialogOpen} onOpenChange={handleBlockedCountriesOpenChange}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setIsBlockedCountriesDialogOpen(true)}
                >
                  {blockedCountriesButtonLabel}
                </Button>

                <DialogContent className="max-w-2xl sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t('Blocked countries')}</DialogTitle>
                    <DialogDescription>{blockedCountriesDialogDescription}</DialogDescription>
                  </DialogHeader>
                  {blockedCountriesContent}
                  <DialogFooter className="sm:justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={blockedCountries.length === 0}
                      onClick={onClearBlockedCountries}
                    >
                      {t('Clear all')}
                    </Button>
                    <Button type="button" onClick={() => setIsBlockedCountriesDialogOpen(false)}>
                      {t('Done')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {selectedBlockedCountryOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedBlockedCountryOptions.map((option) => (
                <Badge key={option.code} variant="outline" className="gap-1.5 pr-1">
                  <span>{option.code}</span>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-black/10"
                    onClick={() => onToggleBlockedCountry(option.code, false)}
                    aria-label={t('Remove blocked country')}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('No blocked countries selected.')}</p>
          )}
        </div>
      </SettingsAccordionSection>
    </>
  )
}

export default LegalSection
