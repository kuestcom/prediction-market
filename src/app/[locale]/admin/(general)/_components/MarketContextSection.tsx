'use client'

import type { MarketContextVariable } from '@/lib/ai/market-context-template'
import { PlusIcon, TextSelectIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import SettingsAccordionSection from './SettingsAccordionSection'

interface MarketContextSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  prompt: string
  onPromptChange: (value: string) => void
  variables: MarketContextVariable[]
}

export default function MarketContextSection({
  isPending,
  openSections,
  onToggleSection,
  enabled,
  onEnabledChange,
  prompt,
  onPromptChange,
  variables,
}: MarketContextSectionProps) {
  const t = useExtracted()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variableLiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPromptHighlighted, setIsPromptHighlighted] = useState(false)
  const [liftedVariableKey, setLiftedVariableKey] = useState<string | null>(null)

  useEffect(function cleanupVariableAnimationTimers() {
    const highlightRef = highlightTimeoutRef
    const variableLiftRef = variableLiftTimeoutRef

    return function cleanup() {
      if (highlightRef.current) {
        clearTimeout(highlightRef.current)
      }
      if (variableLiftRef.current) {
        clearTimeout(variableLiftRef.current)
      }
    }
  }, [])

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
        return t('24-hour trading volume in USD.')
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
      onPromptChange(`${prompt}${placeholder}`)
      return
    }

    const { selectionStart, selectionEnd, value } = textarea
    const start = selectionStart ?? value.length
    const end = selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${placeholder}${value.slice(end)}`
    onPromptChange(nextValue)

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
    <SettingsAccordionSection
      value="market-context"
      isOpen={openSections.includes('market-context')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <TextSelectIcon className="size-4 text-muted-foreground" />
          {t('Market Context')}
        </h3>
      )}
    >
      <div className="grid gap-4">
        <section className="flex items-center justify-between gap-3 rounded-lg border p-4 sm:p-6">
          <div className="grid gap-1">
            <Label htmlFor="market-context-enabled" className="text-base font-semibold">
              {t('Enable market context')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('You need to enable OpenRouter, the credentials and model selection are in')}
              {' '}
              <Link href="/admin/integrations" className="underline underline-offset-4">
                {t('Integrations')}
              </Link>
              .
            </p>
          </div>
          <Switch
            id="market-context-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={isPending}
          />
        </section>

        <section className="grid gap-4 rounded-lg border p-4 sm:p-6">
          <div className="grid gap-2">
            <Label htmlFor="market-context-prompt" className="text-base font-semibold">
              {t('Prompt template')}
            </Label>
            <Textarea
              id="market-context-prompt"
              ref={textareaRef}
              rows={16}
              value={prompt}
              onChange={event => onPromptChange(event.target.value)}
              disabled={isPending}
              className={cn({ 'bg-primary/5 ring-2 ring-primary/35 transition-colors': isPromptHighlighted })}
            />
            <p className="text-sm text-muted-foreground">
              {t('Use the variables below to blend live market data into the instructions. They will be replaced before the request is sent.')}
            </p>
          </div>

          <div className="grid min-w-0 gap-3">
            <span className="text-base font-semibold">{t('Available variables')}</span>
            <div className="-mx-4 -mb-4 border-t sm:-mx-6 sm:-mb-6">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-foreground">
                      <th className="w-80 px-4 py-2 text-left font-semibold">
                        {t('Variables')}
                      </th>
                      <th className="px-6 py-2 text-left font-semibold">
                        {t('Description')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map(variable => (
                      <tr
                        key={variable.key}
                        className="group border-b transition-colors last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="px-4 py-2 font-mono text-sm">
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 text-nowrap transition-transform duration-200',
                              { '-translate-y-0.5': liftedVariableKey === variable.key },
                            )}
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
                                  aria-label={t('Add {variable} variable', { variable: `[${variable.key}]` })}
                                  className={cn(
                                    `
                                      size-5 rounded-full bg-primary p-0 text-background shadow-none
                                      transition-transform duration-200
                                      hover:bg-primary/90
                                    `,
                                    { '-translate-y-0.5': liftedVariableKey === variable.key },
                                  )}
                                >
                                  <PlusIcon className="size-2.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{t('Insert into prompt')}</TooltipContent>
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
          </div>
        </section>
      </div>
    </SettingsAccordionSection>
  )
}
