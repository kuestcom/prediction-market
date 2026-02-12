'use client'

import type { SupportedLocale } from '@/i18n/locales'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateLocalesSettingsAction } from '@/app/[locale]/admin/locales/_actions/update-locales-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_LOCALE, LOCALE_LABELS } from '@/i18n/locales'
import { Link } from '@/i18n/navigation'

const initialState = {
  error: null,
}

interface AdminLocalesSettingsFormProps {
  supportedLocales: readonly SupportedLocale[]
  enabledLocales: SupportedLocale[]
  automaticTranslationsEnabled: boolean
  isOpenRouterConfigured: boolean
}

export default function AdminLocalesSettingsForm({
  supportedLocales,
  enabledLocales,
  automaticTranslationsEnabled,
  isOpenRouterConfigured,
}: AdminLocalesSettingsFormProps) {
  const t = useExtracted()
  const [state, formAction, isPending] = useActionState(updateLocalesSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)
  const initialStateMap = useMemo(() => {
    const enabledSet = new Set(enabledLocales)
    return supportedLocales.reduce<Record<SupportedLocale, boolean>>((acc, locale) => {
      acc[locale] = enabledSet.has(locale)
      return acc
    }, {} as Record<SupportedLocale, boolean>)
  }, [enabledLocales, supportedLocales])
  const initialAutomaticTranslationsState = useMemo(() => {
    return isOpenRouterConfigured && automaticTranslationsEnabled
  }, [automaticTranslationsEnabled, isOpenRouterConfigured])
  const [enabledState, setEnabledState] = useState(initialStateMap)
  const [automaticTranslationsState, setAutomaticTranslationsState] = useState(initialAutomaticTranslationsState)

  useEffect(() => {
    setEnabledState(initialStateMap)
  }, [initialStateMap])

  useEffect(() => {
    setAutomaticTranslationsState(initialAutomaticTranslationsState)
  }, [initialAutomaticTranslationsState])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success(t('Locales updated successfully!'))
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, state.error, t])

  function handleToggle(locale: SupportedLocale, nextValue: boolean) {
    setEnabledState(prev => ({
      ...prev,
      [locale]: locale === DEFAULT_LOCALE ? true : nextValue,
    }))
  }

  function handleAutomaticTranslationsToggle(nextValue: boolean) {
    if (!isOpenRouterConfigured) {
      return
    }

    setAutomaticTranslationsState(nextValue)
  }

  const automaticTranslationsValue = isOpenRouterConfigured && automaticTranslationsState

  return (
    <Form action={formAction} className="grid gap-4">
      <section className="grid gap-4 rounded-lg border p-6">
        {supportedLocales.map((locale) => {
          const isDefault = locale === DEFAULT_LOCALE
          const checked = isDefault || enabledState[locale]
          const switchId = `enabled_locale_${locale}`

          return (
            <div key={locale} className="flex items-center justify-between gap-4">
              <div className="grid gap-1">
                <Label htmlFor={switchId} className="text-sm font-medium">{LOCALE_LABELS[locale]}</Label>
                <span className="text-xs text-muted-foreground">
                  {isDefault ? t('Default locale') : locale.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id={switchId}
                  checked={checked}
                  onCheckedChange={value => handleToggle(locale, value)}
                  disabled={isDefault || isPending}
                />
                {checked && (
                  <input type="hidden" name="enabled_locales" value={locale} />
                )}
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 rounded-lg border p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-1">
            <Label htmlFor="automatic_translations_enabled" className="text-sm font-medium">
              {t('Automatic translations of event titles and categories')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('You need to enable OpenRouter, the credentials and model selection are in')}
              {' '}
              <Link href="/admin" className="underline underline-offset-4">
                {t('General Settings')}
              </Link>
              .
            </p>
          </div>
          <Switch
            id="automatic_translations_enabled"
            checked={automaticTranslationsValue}
            onCheckedChange={handleAutomaticTranslationsToggle}
            disabled={!isOpenRouterConfigured || isPending}
          />
        </div>
        <input
          type="hidden"
          name="automatic_translations_enabled"
          value={automaticTranslationsValue ? 'true' : 'false'}
        />
      </section>

      {state.error && <InputError message={state.error} />}

      <Button type="submit" className="ms-auto w-40" disabled={isPending}>
        {isPending ? t('Saving...') : t('Save changes')}
      </Button>
    </Form>
  )
}
