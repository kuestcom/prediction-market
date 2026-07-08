import type { AdminCreateEventFormProps } from './admin-create-event-form-types'
import type { useAdminCreateEventForm } from './useAdminCreateEventForm'
import { CircleHelpIcon, Loader2Icon, SparkleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TEMPLATE_TOKEN_EXAMPLES, TEMPLATE_TOKEN_HELP_TEXT } from './admin-create-event-form-constants'

type AdminCreateEventFormState = ReturnType<typeof useAdminCreateEventForm>
type EventCreationMode = NonNullable<AdminCreateEventFormProps['creationMode']>

export function AdminCreateEventStepResolution({
  state,
  creationMode,
}: {
  state: AdminCreateEventFormState
  creationMode: EventCreationMode
}) {
  const {
    form,
    handleFieldChange,
    isGeneratingRules,
    recurringEditorialWarnings,
    recurringOccurrencePreviews,
    recurringResolvedRules,
    setRulesGeneratorDialogOpen,
  } = state

  return (
    <Card className="bg-background">
      <CardHeader className="pt-8 pb-6">
        <CardTitle>Resolution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pb-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution-source-url">Resolution source URL (optional)</Label>
            <Input
              id="resolution-source-url"
              value={form.resolutionSource}
              onChange={event => handleFieldChange('resolutionSource', event.target.value)}
              placeholder="https://www.reuters.com/"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="resolution-rules">Resolution rules</Label>
                {creationMode === 'recurring' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground transition hover:text-foreground">
                        <CircleHelpIcon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-left">
                      <div className="grid gap-2">
                        <p>{TEMPLATE_TOKEN_HELP_TEXT}</p>
                        {TEMPLATE_TOKEN_EXAMPLES.map(item => (
                          <p key={`rules-token-${item}`}>{item}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRulesGeneratorDialogOpen(true)}
                disabled={isGeneratingRules}
              >
                {isGeneratingRules
                  ? <Loader2Icon className="mr-2 size-4 animate-spin" />
                  : <SparkleIcon className="mr-2 size-4" />}
                Generate with AI
              </Button>
            </div>
            <Textarea
              id="resolution-rules"
              value={form.resolutionRules}
              onChange={event => handleFieldChange('resolutionRules', event.target.value)}
              placeholder="Define official source, UTC cutoff, tie/cancellation handling, and fallback source."
              className="min-h-36"
            />
            {creationMode === 'recurring' && recurringResolvedRules && recurringResolvedRules !== form.resolutionRules.trim() && (
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                Preview:
                {' '}
                {recurringResolvedRules}
              </p>
            )}
            {creationMode === 'recurring' && recurringOccurrencePreviews.length > 1 && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Recurring preview samples</p>
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  {recurringOccurrencePreviews.map((preview, index) => (
                    <div key={`${preview.slug}-${index}`} className="space-y-1">
                      <p className="font-medium text-foreground">{index === 0 ? 'First occurrence' : 'Next occurrence'}</p>
                      <p>
                        <span className="font-medium text-foreground">Title:</span>
                        {' '}
                        {preview.title}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Slug:</span>
                        {' '}
                        {preview.slug}
                      </p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-medium text-foreground">Rules:</span>
                        {' '}
                        {preview.resolutionRules}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {creationMode === 'recurring' && recurringEditorialWarnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Recurring warnings</p>
                <div className="mt-2 space-y-1">
                  {recurringEditorialWarnings.map(warning => (
                    <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
