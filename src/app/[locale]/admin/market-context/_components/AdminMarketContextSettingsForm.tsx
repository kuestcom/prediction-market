'use client'

import type { MarketContextVariable } from '@/lib/ai/market-context-template'
import { PlusIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateMarketContextSettingsAction } from '@/app/[locale]/admin/market-context/_actions/update-market-context-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'

const initialState = {
  error: null,
}

interface AdminMarketContextSettingsFormProps {
  defaultPrompt: string
  isEnabled: boolean
  variables: MarketContextVariable[]
}

export default function AdminMarketContextSettingsForm({
  defaultPrompt,
  isEnabled,
  variables,
}: AdminMarketContextSettingsFormProps) {
  const t = useExtracted()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variableLiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [promptValue, setPromptValue] = useState(defaultPrompt)
  const [enabled, setEnabled] = useState(isEnabled)
  const [isPromptHighlighted, setIsPromptHighlighted] = useState(false)
  const [liftedVariableKey, setLiftedVariableKey] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(updateMarketContextSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  useEffect(() => {
    setPromptValue(defaultPrompt)
  }, [defaultPrompt])

  useEffect(() => {
    setEnabled(isEnabled)
  }, [isEnabled])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      if (variableLiftTimeoutRef.current) {
        clearTimeout(variableLiftTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success(t('Settings updated successfully!'))
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, state.error, t])

  function getVariableDescription(variable: MarketContextVariable) {
    switch (variable.key) {
      case 'event-title':
        return t('Full event headline.')
      case 'event-description':
        return t('Primary description provided for the event.')
      case 'event-main-tag':
        return t('Primary tag associated with the event.')
      case 'event-creator':
        return t('Event creator name or address.')
      case 'event-created-at':
        return t('ISO timestamp for when the event was created.')
      case 'market-estimated-end-date':
        return t('Best estimate for when the market should resolve.')
      case 'market-title':
        return t('Title for the selected market.')
      case 'market-probability':
        return t('Probability formatted as a percentage.')
      case 'market-price':
        return t('Current YES share price formatted in cents.')
      case 'market-volume-24h':
        return t('24 hour trading volume in USD.')
      case 'market-volume-total':
        return t('Lifetime trading volume in USD.')
      case 'market-outcomes':
        return t('Multi-line bullet list detailing each outcome.')
      default:
        return variable.description
    }
  }

  function handleInsertVariable(key: string) {
    const placeholder = `[${key}]`
    const textarea = textareaRef.current

    if (variableLiftTimeoutRef.current) {
      clearTimeout(variableLiftTimeoutRef.current)
    }
    setLiftedVariableKey(key)
    variableLiftTimeoutRef.current = setTimeout(() => {
      setLiftedVariableKey(null)
    }, 260)

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }
    setIsPromptHighlighted(true)
    highlightTimeoutRef.current = setTimeout(() => {
      setIsPromptHighlighted(false)
    }, 550)

    if (!textarea) {
      setPromptValue(prev => `${prev}${placeholder}`)
      return
    }

    const { selectionStart, selectionEnd, value } = textarea
    const start = selectionStart ?? value.length
    const end = selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${placeholder}${value.slice(end)}`
    setPromptValue(nextValue)

    queueMicrotask(() => {
      textarea.focus()
      const cursor = start + placeholder.length
      textarea.setSelectionRange(cursor, cursor)
      textarea.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

  return (
    <Form action={formAction} className="grid gap-4">
      <input type="hidden" name="market_context_enabled" value={enabled ? 'true' : 'false'} />

      <section className="flex items-center justify-between gap-3 rounded-lg border p-6">
        <div className="grid gap-1">
          <Label htmlFor="market_context_enabled" className="text-base font-semibold">{t('Enable market context')}</Label>
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
          id="market_context_enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={isPending}
        />
      </section>

      <section className="grid gap-4 rounded-lg border p-6">
        <div className="grid gap-2">
          <Label htmlFor="market_context_prompt" className="text-base font-semibold">{t('Prompt template')}</Label>
          <Textarea
            id="market_context_prompt"
            name="market_context_prompt"
            ref={textareaRef}
            rows={16}
            value={promptValue}
            onChange={event => setPromptValue(event.target.value)}
            disabled={isPending}
            className={isPromptHighlighted ? 'bg-primary/5 ring-2 ring-primary/35 transition-colors' : undefined}
          />
          <p className="text-sm text-muted-foreground">
            {t('Use the variables below to blend live market data into the instructions. They will be replaced before the request is sent.')}
          </p>
        </div>

        <div className="grid gap-3">
          <span className="text-base font-semibold">{t('Available variables')}</span>
          <div className="-mx-6 -mb-6 border-t">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-foreground">
                  <th className="w-80 px-4 py-2 text-left font-semibold">
                    Variables
                  </th>
                  <th className="px-6 py-2 text-left font-semibold">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {variables.map(variable => (
                  <tr key={variable.key} className="group border-b transition-colors last:border-b-0 hover:bg-muted/50">
                    <td className="px-4 py-2 font-mono text-sm">
                      <span
                        className={`
                          inline-flex items-center gap-2 text-nowrap transition-transform duration-200
                          ${liftedVariableKey === variable.key ? '-translate-y-0.5' : ''}
                        `}
                      >
                        <span>
                          [
                          {variable.key}
                          ]
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              disabled={isPending}
                              onClick={() => handleInsertVariable(variable.key)}
                              aria-label={`Add [${variable.key}] variable`}
                              className={`
                                size-5 rounded-full bg-primary p-0 text-background shadow-none transition-transform
                                duration-200
                                hover:bg-primary/90
                                ${liftedVariableKey === variable.key ? '-translate-y-0.5' : ''}
                              `}
                            >
                              <PlusIcon className="size-2.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Insert into prompt</TooltipContent>
                        </Tooltip>
                      </span>
                    </td>
                    <td className="p-2 text-sm/5 text-muted-foreground">
                      {getVariableDescription(variable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {state.error ? <InputError message={state.error} /> : null}

      <div className="flex justify-end">
        <Button type="submit" className="w-40" disabled={isPending}>
          {isPending ? t('Saving...') : t('Save changes')}
        </Button>
      </div>
    </Form>
  )
}
