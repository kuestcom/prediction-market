'use client'

import type { MarketContextVariable } from '@/lib/ai/market-context-template'
import Form from 'next/form'
import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateMarketContextSettingsAction } from '@/app/[locale]/admin/market-context/_actions/update-market-context-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [promptValue, setPromptValue] = useState(defaultPrompt)
  const [enabled, setEnabled] = useState(isEnabled)
  const [state, formAction, isPending] = useActionState(updateMarketContextSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  useEffect(() => {
    setPromptValue(defaultPrompt)
  }, [defaultPrompt])

  useEffect(() => {
    setEnabled(isEnabled)
  }, [isEnabled])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success('Settings updated successfully!')
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, state.error])

  function handleInsertVariable(key: string) {
    const placeholder = `[${key}]`
    const textarea = textareaRef.current

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
    })
  }

  return (
    <Form action={formAction} className="grid max-w-3xl gap-8">
      <input type="hidden" name="openrouter_enabled" value={enabled ? 'true' : 'false'} />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Label htmlFor="openrouter_enabled">Enable market context</Label>
          <Switch
            id="openrouter_enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isPending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="market_context_prompt">Prompt template</Label>
          <Textarea
            id="market_context_prompt"
            name="market_context_prompt"
            ref={textareaRef}
            rows={16}
            value={promptValue}
            onChange={event => setPromptValue(event.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Use the variables below to blend live market data into the instructions. They will be replaced before the request is sent.
          </p>
        </div>

        <div className="grid gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase">Available variables</span>
          <div className="flex flex-wrap gap-2">
            {variables.map(variable => (
              <Button
                key={variable.key}
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => handleInsertVariable(variable.key)}
                title={variable.description}
                className="rounded-full"
              >
                [
                {variable.key}
                ]
              </Button>
            ))}
          </div>
          <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
            {variables.map(variable => (
              <li key={`${variable.key}-description`}>
                <span className="font-medium">
                  [
                  {variable.key}
                  ]
                </span>
                {' – '}
                {variable.description}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {state.error ? <InputError message={state.error} /> : null}

      <div className="flex justify-end">
        <Button type="submit" className="w-40" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </Form>
  )
}
