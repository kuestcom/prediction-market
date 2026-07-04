'use client'

import type { CustomJavascriptCodeConfig, CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import { PlugIcon, RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  MAX_CUSTOM_JAVASCRIPT_CODE_NAME_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODE_SNIPPET_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODES,
} from '@/lib/custom-javascript-code'
import { cn } from '@/lib/utils'
import SettingsAccordionSection from './SettingsAccordionSection'

const AUTOMATIC_MODEL_VALUE = '__AUTOMATIC__'

interface ModelOption {
  id: string
  label: string
  contextWindow?: number
}

interface CustomJavascriptCodeDraft extends CustomJavascriptCodeConfig {
  id: string
}

interface DisablePageOption {
  value: CustomJavascriptCodeDisablePage
  label: string
}

interface IntegrationsSectionProps {
  isPending: boolean
  openSections: string[]
  onToggleSection: (value: string) => void
  googleAnalyticsId: string
  onGoogleAnalyticsIdChange: (value: string) => void
  openRouterApiKey: string
  onOpenRouterApiKeyChange: (value: string) => void
  openRouterSelectValue: string
  onOpenRouterModelChange: (nextValue: string) => void
  openRouterModelSelectEnabled: boolean
  openRouterModelOptions: ModelOption[]
  openRouterModelsError: string | undefined
  isRefreshingOpenRouterModels: boolean
  trimmedOpenRouterApiKey: string
  onRefreshOpenRouterModels: () => void
  initialOpenRouterApiKeyConfigured: boolean
  lifiIntegrator: string
  onLifiIntegratorChange: (value: string) => void
  lifiApiKey: string
  onLifiApiKeyChange: (value: string) => void
  initialLiFiApiKeyConfigured: boolean
  customJavascriptCodes: CustomJavascriptCodeDraft[]
  onAddCustomJavascriptCode: () => void
  onRemoveCustomJavascriptCode: (index: number) => void
  onUpdateCustomJavascriptCode: (
    index: number,
    updater: (code: CustomJavascriptCodeDraft) => CustomJavascriptCodeDraft,
  ) => void
  onToggleCustomJavascriptCodeDisableOn: (
    index: number,
    value: CustomJavascriptCodeDisablePage,
    checked: boolean,
  ) => void
  customJavascriptCodeDisablePageOptions: DisablePageOption[]
}

function IntegrationsSection({
  isPending,
  openSections,
  onToggleSection,
  googleAnalyticsId,
  onGoogleAnalyticsIdChange,
  openRouterApiKey,
  onOpenRouterApiKeyChange,
  openRouterSelectValue,
  onOpenRouterModelChange,
  openRouterModelSelectEnabled,
  openRouterModelOptions,
  openRouterModelsError,
  isRefreshingOpenRouterModels,
  trimmedOpenRouterApiKey,
  onRefreshOpenRouterModels,
  initialOpenRouterApiKeyConfigured,
  lifiIntegrator,
  onLifiIntegratorChange,
  lifiApiKey,
  onLifiApiKeyChange,
  initialLiFiApiKeyConfigured,
  customJavascriptCodes,
  onAddCustomJavascriptCode,
  onRemoveCustomJavascriptCode,
  onUpdateCustomJavascriptCode,
  onToggleCustomJavascriptCodeDisableOn,
  customJavascriptCodeDisablePageOptions,
}: IntegrationsSectionProps) {
  const t = useExtracted()

  return (
    <SettingsAccordionSection
      value="integrations"
      isOpen={openSections.includes('integrations')}
      onToggle={onToggleSection}
      header={(
        <h3 className="flex items-center gap-2 text-base font-medium">
          <PlugIcon className="size-4 text-muted-foreground" />
          {t('Integrations')}
        </h3>
      )}
    >
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="theme-google-analytics-id">{t('Google Analytics ID')}</Label>
          <Input
            id="theme-google-analytics-id"
            name="google_analytics_id"
            maxLength={120}
            value={googleAnalyticsId}
            onChange={event => onGoogleAnalyticsIdChange(event.target.value)}
            disabled={isPending}
            placeholder={t('G-XXXXXXXXXX (optional)')}
          />
        </div>

        <div className="grid gap-6 border-t border-border/50 pt-6">
          <div className="grid gap-2">
            <h4 className="text-sm font-medium">{t('OpenRouter integration')}</h4>
            <Label htmlFor="openrouter_key">{t('API key')}</Label>
            <Input
              id="openrouter_key"
              name="openrouter_api_key"
              type="password"
              autoComplete="off"
              maxLength={256}
              value={openRouterApiKey}
              onChange={event => onOpenRouterApiKeyChange(event.target.value)}
              disabled={isPending}
              placeholder={
                initialOpenRouterApiKeyConfigured && !trimmedOpenRouterApiKey
                  ? '••••••••••••••••'
                  : t('Enter OpenRouter API key')
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('Generate an API key at')}
              {' '}
              <a
                href="https://openrouter.ai/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                openrouter.ai/settings/keys
              </a>
              .
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="openrouter_model">{t('Preferred OpenRouter model')}</Label>
            <div className="flex items-center gap-2">
              <Select
                value={openRouterSelectValue}
                onValueChange={onOpenRouterModelChange}
                disabled={!openRouterModelSelectEnabled || isPending}
              >
                <SelectTrigger id="openrouter_model" className="h-12! w-full max-w-md justify-between text-left">
                  <SelectValue placeholder={t('Select a model')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTOMATIC_MODEL_VALUE}>
                    {t('Let OpenRouter decide')}
                  </SelectItem>
                  {openRouterModelOptions.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col gap-0.5">
                        <span>{model.label}</span>
                        {model.contextWindow
                          ? (
                              <span className="text-xs text-muted-foreground">
                                {t('Context window:')}
                                {' '}
                                {model.contextWindow.toLocaleString()}
                              </span>
                            )
                          : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="size-12 shrink-0"
                disabled={!trimmedOpenRouterApiKey || isPending || isRefreshingOpenRouterModels}
                onClick={onRefreshOpenRouterModels}
                title={t('Refresh models')}
                aria-label={t('Refresh models')}
              >
                <RefreshCwIcon className={cn('size-4', { 'animate-spin': isRefreshingOpenRouterModels })} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('These AI models are used for Market Context on event pages, market creation, and featured markets on the home page. Explore available models at')}
              {' '}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                openrouter.ai/models
              </a>
              .
            </p>
            {openRouterModelsError
              ? (
                  <p className="text-xs text-destructive">{openRouterModelsError}</p>
                )
              : null}
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/50 pt-6 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <h4 className="text-sm font-medium">{t('LI.FI integration')}</h4>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-lifi-integrator">{t('Integrator name')}</Label>
            <Input
              id="theme-lifi-integrator"
              name="lifi_integrator"
              maxLength={120}
              value={lifiIntegrator}
              onChange={event => onLifiIntegratorChange(event.target.value)}
              disabled={isPending}
              placeholder={t('your-app-id (optional)')}
            />
            <p className="text-xs text-muted-foreground">
              {t('Create an account and generate one at')}
              {' '}
              <a
                href="https://li.fi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                li.fi
              </a>
              .
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-lifi-api-key">{t('API key')}</Label>
            <Input
              id="theme-lifi-api-key"
              name="lifi_api_key"
              type="password"
              autoComplete="off"
              maxLength={256}
              value={lifiApiKey}
              onChange={event => onLifiApiKeyChange(event.target.value)}
              disabled={isPending}
              placeholder={
                initialLiFiApiKeyConfigured && !lifiApiKey.trim()
                  ? '••••••••••••••••'
                  : t('Enter API key (optional)')
              }
            />
            <p className="invisible text-xs text-muted-foreground" aria-hidden="true">
              {t('Spacer')}
            </p>
          </div>
        </div>

        <div className="grid gap-3 border-t border-border/50 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="grid gap-1">
              <h4 className="text-sm font-medium">{t('Custom Integrations')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('Add external scripts to enable features like chat, analytics, tracking, and more')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || customJavascriptCodes.length >= MAX_CUSTOM_JAVASCRIPT_CODES}
              onClick={onAddCustomJavascriptCode}
            >
              {t('Add Integration')}
            </Button>
          </div>

          <div className="grid gap-3">
            {customJavascriptCodes.length > 0
              ? customJavascriptCodes.map((code, index) => (
                  <div
                    key={code.id}
                    className="grid gap-4 rounded-xl border border-border/60 bg-muted/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-medium">
                        {code.name.trim() || `${t('Script')} ${index + 1}`}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => onRemoveCustomJavascriptCode(index)}
                      >
                        {t('Remove')}
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`theme-custom-javascript-code-name-${code.id}`}>{t('Name')}</Label>
                        <Input
                          id={`theme-custom-javascript-code-name-${code.id}`}
                          value={code.name}
                          onChange={event => onUpdateCustomJavascriptCode(index, current => ({
                            ...current,
                            name: event.target.value,
                          }))}
                          disabled={isPending}
                          maxLength={MAX_CUSTOM_JAVASCRIPT_CODE_NAME_LENGTH}
                          placeholder={t('Support widget')}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`theme-custom-javascript-code-snippet-${code.id}`}>{t('Paste your JavaScript snippet here')}</Label>
                        <Textarea
                          id={`theme-custom-javascript-code-snippet-${code.id}`}
                          value={code.snippet}
                          onChange={event => onUpdateCustomJavascriptCode(index, current => ({
                            ...current,
                            snippet: event.target.value,
                          }))}
                          disabled={isPending}
                          rows={6}
                          maxLength={MAX_CUSTOM_JAVASCRIPT_CODE_SNIPPET_LENGTH}
                          placeholder={'<script src="https://..."></script>'}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>{t('Disable on')}</Label>
                      <div className="flex flex-wrap gap-3">
                        {customJavascriptCodeDisablePageOptions.map((option) => {
                          const fieldId = `theme-custom-javascript-code-${code.id}-disable-${option.value}`
                          return (
                            <label
                              key={option.value}
                              htmlFor={fieldId}
                              className={cn(
                                `
                                  flex min-w-32 cursor-pointer items-center gap-2 rounded-lg border border-border/60
                                  px-3 py-2 text-sm transition-colors
                                  hover:bg-muted/40
                                `,
                                code.disabledOn.includes(option.value) && 'border-primary/50 bg-primary/5',
                              )}
                            >
                              <Checkbox
                                id={fieldId}
                                checked={code.disabledOn.includes(option.value)}
                                disabled={isPending}
                                onCheckedChange={checked => onToggleCustomJavascriptCodeDisableOn(index, option.value, checked === true)}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
    </SettingsAccordionSection>
  )
}

export default IntegrationsSection
