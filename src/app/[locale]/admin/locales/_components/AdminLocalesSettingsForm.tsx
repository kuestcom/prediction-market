'use client'

import type { DragEvent } from 'react'

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import type { SupportedLocale } from '@/i18n/locales'

import { updateLocalesSettingsAction } from '@/app/[locale]/admin/locales/_actions/update-locales-settings'
import LocaleFlag from '@/components/LocaleFlag'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { DEFAULT_LOCALE, LOCALE_LABELS, normalizeEnabledLocales, normalizeLocaleOrder } from '@/i18n/locales'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const initialState = {
  error: null,
}

interface AdminLocalesSettingsFormProps {
  supportedLocales: readonly SupportedLocale[]
  enabledLocales: SupportedLocale[]
  localeOrder?: SupportedLocale[]
  automaticTranslationsEnabled: boolean
  rulesTranslationsEnabled?: boolean
  isOpenRouterConfigured: boolean
}

function buildEnabledState(supportedLocales: readonly SupportedLocale[], enabledLocales: SupportedLocale[]) {
  const enabledSet = new Set(enabledLocales)
  return supportedLocales.reduce<Record<SupportedLocale, boolean>>(
    (acc, locale) => {
      acc[locale] = enabledSet.has(locale)
      return acc
    },
    {} as Record<SupportedLocale, boolean>,
  )
}

function buildLocaleOrder(
  supportedLocales: readonly SupportedLocale[],
  enabledLocales: SupportedLocale[],
  localeOrder?: SupportedLocale[],
) {
  if (localeOrder) {
    return normalizeLocaleOrder(localeOrder, supportedLocales)
  }

  const normalizedEnabledLocales = normalizeEnabledLocales(enabledLocales)
  const enabledSet = new Set(normalizedEnabledLocales)

  return [
    ...normalizedEnabledLocales,
    ...supportedLocales.filter((locale) => !enabledSet.has(locale) && locale !== DEFAULT_LOCALE),
  ]
}

function moveLocale(locales: SupportedLocale[], sourceLocale: SupportedLocale, targetLocale: SupportedLocale) {
  if (sourceLocale === DEFAULT_LOCALE || targetLocale === DEFAULT_LOCALE) {
    return locales
  }

  const sourceIndex = locales.indexOf(sourceLocale)
  const targetIndex = locales.indexOf(targetLocale)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return locales
  }

  const nextLocales = [...locales]
  const [movedLocale] = nextLocales.splice(sourceIndex, 1)
  nextLocales.splice(targetIndex, 0, movedLocale!)
  return nextLocales
}

function useLocalesSettingsForm(
  supportedLocales: readonly SupportedLocale[],
  enabledLocales: SupportedLocale[],
  localeOrder: SupportedLocale[] | undefined,
  automaticTranslationsEnabled: boolean,
  rulesTranslationsEnabled: boolean,
  isOpenRouterConfigured: boolean,
) {
  const t = useExtracted()
  const [state, formAction, isPending] = useActionState(updateLocalesSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)
  const [enabledState, setEnabledState] = useState<Record<SupportedLocale, boolean>>(() =>
    buildEnabledState(supportedLocales, enabledLocales),
  )
  const [orderedLocales, setOrderedLocales] = useState<SupportedLocale[]>(() =>
    buildLocaleOrder(supportedLocales, enabledLocales, localeOrder),
  )
  const [automaticTranslationsState, setAutomaticTranslationsState] = useState(
    () => isOpenRouterConfigured && automaticTranslationsEnabled,
  )
  const [rulesTranslationsState, setRulesTranslationsState] = useState(
    () => isOpenRouterConfigured && rulesTranslationsEnabled,
  )

  useEffect(
    function toastOnLocalesTransition() {
      const transitionedToIdle = wasPendingRef.current && !isPending

      if (transitionedToIdle && state.error === null) {
        toast.success(t('Locales updated successfully!'))
      } else if (transitionedToIdle && state.error) {
        toast.error(state.error)
      }

      wasPendingRef.current = isPending
    },
    [isPending, state.error, t],
  )

  return {
    state,
    formAction,
    isPending,
    enabledState,
    setEnabledState,
    orderedLocales,
    setOrderedLocales,
    automaticTranslationsState,
    setAutomaticTranslationsState,
    rulesTranslationsState,
    setRulesTranslationsState,
  }
}

function AdminLocalesSettingsFormInner({
  supportedLocales,
  enabledLocales,
  localeOrder,
  automaticTranslationsEnabled,
  rulesTranslationsEnabled = false,
  isOpenRouterConfigured,
}: AdminLocalesSettingsFormProps) {
  const t = useExtracted()
  const {
    state,
    formAction,
    isPending,
    enabledState,
    setEnabledState,
    orderedLocales,
    setOrderedLocales,
    automaticTranslationsState,
    setAutomaticTranslationsState,
    rulesTranslationsState,
    setRulesTranslationsState,
  } = useLocalesSettingsForm(
    supportedLocales,
    enabledLocales,
    localeOrder,
    automaticTranslationsEnabled,
    rulesTranslationsEnabled,
    isOpenRouterConfigured,
  )
  const [draggedLocale, setDraggedLocale] = useState<SupportedLocale | null>(null)

  function handleToggle(locale: SupportedLocale, nextValue: boolean) {
    setEnabledState((prev) => ({
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

  function handleRulesTranslationsToggle(nextValue: boolean) {
    if (!isOpenRouterConfigured) {
      return
    }

    setRulesTranslationsState(nextValue)
  }

  function handleDragStart(locale: SupportedLocale, event: DragEvent<HTMLButtonElement>) {
    if (locale === DEFAULT_LOCALE || isPending) {
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', locale)
    setDraggedLocale(locale)
  }

  function handleDrop(targetLocale: SupportedLocale, event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
    const sourceLocale = draggedLocale ?? event.dataTransfer.getData('text/plain')
    if (!sourceLocale || !orderedLocales.includes(sourceLocale as SupportedLocale)) {
      setDraggedLocale(null)
      return
    }

    setOrderedLocales((previous) => moveLocale(previous, sourceLocale as SupportedLocale, targetLocale))
    setDraggedLocale(null)
  }

  function handleMoveLocale(locale: SupportedLocale, direction: 'up' | 'down') {
    setOrderedLocales((previous) => {
      const index = previous.indexOf(locale)
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      const targetLocale = previous[targetIndex]
      if (targetLocale === undefined) {
        return previous
      }

      return moveLocale(previous, locale, targetLocale)
    })
  }

  const automaticTranslationsValue = isOpenRouterConfigured && automaticTranslationsState
  const rulesTranslationsValue = isOpenRouterConfigured && rulesTranslationsState

  return (
    <Form action={formAction} className="grid gap-4">
      <section className="grid gap-4 rounded-lg border p-6">
        <ul className="grid gap-2">
          {orderedLocales.map((locale, index) => {
            const isDefault = locale === DEFAULT_LOCALE
            const checked = isDefault || enabledState[locale]
            const switchId = `enabled_locale_${locale}`

            return (
              <li
                key={locale}
                onDragOver={(event) => {
                  if (draggedLocale) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDrop={(event) => handleDrop(locale, event)}
                className={cn(
                  'flex list-none items-center justify-between gap-4 rounded-md border bg-background px-3 py-2',
                  draggedLocale === locale && 'opacity-50',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isDefault ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">
                      {index + 1}
                    </span>
                  ) : (
                    <button
                      type="button"
                      draggable={!isPending}
                      onDragStart={(event) => handleDragStart(locale, event)}
                      onDragEnd={() => setDraggedLocale(null)}
                      className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                      aria-label={t('Drag to reorder')}
                      disabled={isPending}
                    >
                      <GripVerticalIcon className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  <div className="grid min-w-0 gap-1">
                    <Label htmlFor={switchId} className="flex items-center gap-2 text-sm font-medium">
                      <LocaleFlag locale={locale} />
                      <span>{LOCALE_LABELS[locale]}</span>
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {isDefault ? t('Default locale') : locale.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!isDefault && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isPending || index === 1}
                        onClick={() => handleMoveLocale(locale, 'up')}
                      >
                        <ArrowUpIcon className="size-4" />
                        <span className="sr-only">{t('Move {name} up', { name: LOCALE_LABELS[locale] })}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isPending || index === orderedLocales.length - 1}
                        onClick={() => handleMoveLocale(locale, 'down')}
                      >
                        <ArrowDownIcon className="size-4" />
                        <span className="sr-only">{t('Move {name} down', { name: LOCALE_LABELS[locale] })}</span>
                      </Button>
                    </>
                  )}
                  <Switch
                    id={switchId}
                    checked={checked}
                    onCheckedChange={(value) => handleToggle(locale, value)}
                    disabled={isDefault || isPending}
                  />
                  {checked && <input type="hidden" name="enabled_locales" value={locale} />}
                </div>
              </li>
            )
          })}
        </ul>
        <input type="hidden" name="locale_order" value={JSON.stringify(orderedLocales)} />
      </section>

      <section className="grid gap-4 rounded-lg border p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-1">
            <Label htmlFor="automatic_translations_enabled" className="text-sm font-medium">
              {t('Automatic translations of event titles and categories')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('You need to enable OpenRouter, the credentials and model selection are in')}{' '}
              <Link href="/admin/integrations" className="underline underline-offset-4">
                {t('Integrations')}
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
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <div className="grid gap-1">
            <Label htmlFor="rules_translations_enabled" className="text-sm font-medium">
              {t('Automatic translations of event Rules') || 'Automatic translations of event Rules'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('Translate event Rules into the enabled locales.') ||
                'Translate event Rules into the enabled locales.'}
            </p>
          </div>
          <Switch
            id="rules_translations_enabled"
            checked={rulesTranslationsValue}
            onCheckedChange={handleRulesTranslationsToggle}
            disabled={!isOpenRouterConfigured || isPending}
          />
        </div>
        <input type="hidden" name="rules_translations_enabled" value={rulesTranslationsValue ? 'true' : 'false'} />
      </section>

      {state.error && <InputError message={state.error} />}

      <Button type="submit" className="ms-auto w-40" disabled={isPending}>
        {isPending ? t('Saving...') : t('Save changes')}
      </Button>
    </Form>
  )
}

function useLocalesFormResetKey(props: AdminLocalesSettingsFormProps) {
  return useMemo(
    () =>
      JSON.stringify({
        supportedLocales: props.supportedLocales,
        enabledLocales: props.enabledLocales,
        localeOrder: props.localeOrder,
        automaticTranslationsEnabled: props.automaticTranslationsEnabled,
        rulesTranslationsEnabled: props.rulesTranslationsEnabled,
        isOpenRouterConfigured: props.isOpenRouterConfigured,
      }),
    [
      props.supportedLocales,
      props.enabledLocales,
      props.localeOrder,
      props.automaticTranslationsEnabled,
      props.rulesTranslationsEnabled,
      props.isOpenRouterConfigured,
    ],
  )
}

export default function AdminLocalesSettingsForm(props: AdminLocalesSettingsFormProps) {
  const formResetKey = useLocalesFormResetKey(props)

  return <AdminLocalesSettingsFormInner key={formResetKey} {...props} />
}
