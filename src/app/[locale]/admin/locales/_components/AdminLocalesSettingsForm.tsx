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

const initialState = {
  error: null,
}

interface AdminLocalesSettingsFormProps {
  supportedLocales: readonly SupportedLocale[]
  enabledLocales: SupportedLocale[]
}

export default function AdminLocalesSettingsForm({
  supportedLocales,
  enabledLocales,
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
  const [enabledState, setEnabledState] = useState(initialStateMap)

  useEffect(() => {
    setEnabledState(initialStateMap)
  }, [initialStateMap])

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

  return (
    <Form action={formAction} className="grid gap-4 rounded-lg border p-6">
      {supportedLocales.map((locale) => {
        const isDefault = locale === DEFAULT_LOCALE
        const checked = isDefault || enabledState[locale]

        return (
          <div key={locale} className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <Label className="text-sm font-medium">{LOCALE_LABELS[locale]}</Label>
              <span className="text-xs text-muted-foreground">
                {isDefault ? t('Default locale') : locale.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
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

      {state.error && <InputError message={state.error} />}

      <Button type="submit" className="ms-auto w-40" disabled={isPending}>
        {isPending ? t('Saving...') : t('Save changes')}
      </Button>
    </Form>
  )
}
