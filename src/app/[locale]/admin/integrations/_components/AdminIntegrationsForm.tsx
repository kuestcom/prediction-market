'use client'

import type { KuestSupportPosition } from '@/lib/admin-support-settings'
import type { CustomJavascriptCodeConfig, CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import type { SumsubEnforcement } from '@/lib/sumsub/types'
import { FileBracesIcon, RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useActionState, useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import SettingsAccordionSection from '@/app/[locale]/admin/(general)/_components/SettingsAccordionSection'
import { updateIntegrationsSettingsAction } from '@/app/[locale]/admin/integrations/_actions/update-integrations-settings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { clearLocationHash, useLocationHash } from '@/hooks/useLocationHash'
import {
  MAX_CUSTOM_JAVASCRIPT_CODE_NAME_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODE_SNIPPET_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODES,
  serializeCustomJavascriptCodes,
} from '@/lib/custom-javascript-code'
import { cn } from '@/lib/utils'

const AUTOMATIC_MODEL_VALUE = '__AUTOMATIC__'

interface ModelOption {
  id: string
  label: string
  contextWindow?: number
}

interface CustomJavascriptCodeDraft extends CustomJavascriptCodeConfig {
  id: string
}

export interface AdminIntegrationsFormProps {
  locale: string
  googleAnalyticsId: string
  customJavascriptCodes: CustomJavascriptCodeConfig[]
  lifiIntegrator: string
  lifiApiKeyConfigured: boolean
  openRouterSettings: {
    defaultModel?: string
    isApiKeyConfigured: boolean
    modelOptions: ModelOption[]
    modelsError?: string
  }
  sportsSourceSettings: {
    isPandaScoreTokenConfigured: boolean
    isTheSportsDbApiKeyConfigured: boolean
  }
  arbitrageSettings: {
    enabled: boolean
    multiWalletEnabled: boolean
  }
  kuestSupportSettings: {
    enabled: boolean
    position: KuestSupportPosition
  }
  sumsubSettings: {
    enabled: boolean
    enforcement: SumsubEnforcement
    levelName: string
    appTokenConfigured: boolean
    secretKeyConfigured: boolean
    webhookSecretConfigured: boolean
  }
}

function IntegrationLogo({ src, alt }: { src: string, alt: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white p-1.5">
      <Image src={src} alt={alt} width={28} height={28} className="size-7 object-contain" />
    </span>
  )
}

function IntegrationHeader({
  title,
  description,
  logo,
  customIcon = false,
}: {
  title: string
  description: string
  logo?: string
  customIcon?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {customIcon
        ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <FileBracesIcon className="size-5 text-muted-foreground" />
            </span>
          )
        : <IntegrationLogo src={logo!} alt="" />}
      <span className="grid min-w-0 gap-0.5">
        <span className="text-base font-medium text-foreground">{title}</span>
        <span className="line-clamp-1 text-xs text-muted-foreground">{description}</span>
      </span>
    </div>
  )
}

function OfficialLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">
      {children}
    </a>
  )
}

function toDraft(code: CustomJavascriptCodeConfig, index: number): CustomJavascriptCodeDraft {
  return { id: `custom-integration-${index}`, ...code }
}

function AdminIntegrationsFormInner(props: AdminIntegrationsFormProps) {
  const t = useExtracted()
  const locationHash = useLocationHash()
  const [openSections, setOpenSections] = useState<string[]>([])
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(props.googleAnalyticsId)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState(props.openRouterSettings.defaultModel ?? '')
  const [openRouterModelOptions, setOpenRouterModelOptions] = useState(props.openRouterSettings.modelOptions)
  const [openRouterModelsError, setOpenRouterModelsError] = useState(props.openRouterSettings.modelsError)
  const [isRefreshingOpenRouterModels, setIsRefreshingOpenRouterModels] = useState(false)
  const [theSportsDbApiKey, setTheSportsDbApiKey] = useState('')
  const [pandaScoreToken, setPandaScoreToken] = useState('')
  const [lifiIntegrator, setLifiIntegrator] = useState(props.lifiIntegrator)
  const [lifiApiKey, setLifiApiKey] = useState('')
  const [arbitrageEnabled, setArbitrageEnabled] = useState(props.arbitrageSettings.enabled)
  const [arbitrageMultiWalletEnabled, setArbitrageMultiWalletEnabled] = useState(props.arbitrageSettings.multiWalletEnabled)
  const [kuestSupportEnabled, setKuestSupportEnabled] = useState(props.kuestSupportSettings.enabled)
  const [kuestSupportPosition, setKuestSupportPosition] = useState(props.kuestSupportSettings.position)
  const [sumsubEnabled, setSumsubEnabled] = useState(props.sumsubSettings.enabled)
  const [sumsubAppToken, setSumsubAppToken] = useState('')
  const [sumsubSecretKey, setSumsubSecretKey] = useState('')
  const [sumsubWebhookSecret, setSumsubWebhookSecret] = useState('')
  const [sumsubLevelName, setSumsubLevelName] = useState(props.sumsubSettings.levelName)
  const [sumsubEnforcement, setSumsubEnforcement] = useState<SumsubEnforcement>(props.sumsubSettings.enforcement)
  const [isTestingSumsub, setIsTestingSumsub] = useState(false)
  const [customJavascriptCodes, setCustomJavascriptCodes] = useState<CustomJavascriptCodeDraft[]>(
    props.customJavascriptCodes.map(toDraft),
  )

  const submitAction = useCallback(async (previousState: { error: string | null }, formData: FormData) => {
    const result = await updateIntegrationsSettingsAction(previousState, formData)
    if (result.error) {
      toast.error(result.error)
    }
    else {
      toast.success(t('Settings saved successfully!'))
    }
    return result
  }, [t])
  const [state, formAction, isPending] = useActionState(submitAction, { error: null })

  const serializedCustomJavascriptCodes = useMemo(() => serializeCustomJavascriptCodes(
    customJavascriptCodes.map(({ id: _id, ...code }) => code),
  ), [customJavascriptCodes])
  const customDisablePageOptions = useMemo(() => ([
    { value: 'home' as const, label: t('Home') },
    { value: 'event' as const, label: '/event' },
    { value: 'portfolio' as const, label: '/portfolio' },
    { value: 'settings' as const, label: '/settings' },
    { value: 'docs' as const, label: '/docs' },
    { value: 'admin' as const, label: '/admin' },
  ]), [t])
  const canTestSumsub = Boolean(
    (sumsubAppToken.trim() || props.sumsubSettings.appTokenConfigured)
    && (sumsubSecretKey.trim() || props.sumsubSettings.secretKeyConfigured)
    && sumsubLevelName.trim(),
  )
  const linkedOpenSection = locationHash === 'openrouter' || locationHash === 'kuest-support'
    ? locationHash
    : null
  const visibleOpenSections = useMemo(
    () => new Set(linkedOpenSection ? [...openSections, linkedOpenSection] : openSections),
    [linkedOpenSection, openSections],
  )

  function toggleSection(value: string) {
    const isOpen = visibleOpenSections.has(value)
    if (linkedOpenSection === value) {
      clearLocationHash()
    }
    setOpenSections(previous => isOpen
      ? previous.filter(section => section !== value)
      : [...previous, value])
  }

  async function refreshOpenRouterModels() {
    if (!openRouterApiKey.trim()) {
      return
    }
    setIsRefreshingOpenRouterModels(true)
    setOpenRouterModelsError(undefined)
    try {
      const response = await fetch(`/${props.locale}/admin/api/openrouter-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openRouterApiKey.trim() }),
      })
      const payload = await response.json() as { models?: ModelOption[], error?: string }
      if (!response.ok || !payload.models) {
        throw new Error(payload.error ?? t('Unable to load models. Please verify the API key.'))
      }
      setOpenRouterModelOptions(payload.models)
      if (!payload.models.some(model => model.id === openRouterModel)) {
        setOpenRouterModel('')
      }
    }
    catch (error) {
      setOpenRouterModelsError(error instanceof Error ? error.message : t('Unable to load models. Please verify the API key.'))
    }
    finally {
      setIsRefreshingOpenRouterModels(false)
    }
  }

  async function testSumsubConnection() {
    setIsTestingSumsub(true)
    try {
      const response = await fetch(`/${props.locale}/admin/api/sumsub/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appToken: sumsubAppToken, secretKey: sumsubSecretKey, levelName: sumsubLevelName }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || t('Unable to test Sumsub.'))
      }
      toast.success(t('Sumsub connection successful.'), {
        description: t('Webhook Secret is validated only when a real webhook is received.'),
      })
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('Unable to test Sumsub.'))
    }
    finally {
      setIsTestingSumsub(false)
    }
  }

  function updateCustomCode(index: number, updater: (code: CustomJavascriptCodeDraft) => CustomJavascriptCodeDraft) {
    setCustomJavascriptCodes(previous => previous.map((code, codeIndex) => codeIndex === index ? updater(code) : code))
  }

  function toggleCustomDisabledOn(index: number, page: CustomJavascriptCodeDisablePage, checked: boolean) {
    updateCustomCode(index, code => ({
      ...code,
      disabledOn: checked
        ? Array.from(new Set([...code.disabledOn, page]))
        : code.disabledOn.filter(value => value !== page),
    }))
  }

  return (
    <form action={formAction} className="grid max-w-full min-w-0 gap-6">
      <input type="hidden" name="openrouter_model" value={openRouterModel} />
      <input type="hidden" name="arbitrage_enabled" value={String(arbitrageEnabled)} />
      <input type="hidden" name="arbitrage_multi_wallet_enabled" value={String(arbitrageMultiWalletEnabled)} />
      <input type="hidden" name="kuest_support_enabled" value={String(kuestSupportEnabled)} />
      <input type="hidden" name="kuest_support_position" value={kuestSupportPosition} />
      <input type="hidden" name="sumsub_enabled" value={String(sumsubEnabled)} />
      <input type="hidden" name="sumsub_enforcement" value={sumsubEnforcement} />
      <input type="hidden" name="custom_javascript_codes_json" value={serializedCustomJavascriptCodes} />

      <div className="grid gap-4">
        <SettingsAccordionSection
          value="google-analytics"
          isOpen={visibleOpenSections.has('google-analytics')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="Google Analytics" description={t('Measure visits and user behavior with Google Analytics.')} logo="/images/logos/google-analytics.svg" />}
        >
          <div className="grid gap-2">
            <Label htmlFor="integration-google-analytics-id">{t('Google Analytics ID')}</Label>
            <Input id="integration-google-analytics-id" name="google_analytics_id" maxLength={120} value={googleAnalyticsId} onChange={event => setGoogleAnalyticsId(event.target.value)} disabled={isPending} placeholder={t('G-XXXXXXXXXX (optional)')} />
            <OfficialLink href="https://analytics.google.com">{t('Open the official Google Analytics site')}</OfficialLink>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="openrouter"
          isOpen={visibleOpenSections.has('openrouter')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="OpenRouter" description={t('Use AI models for market creation, context, translations, and featured markets.')} logo="/images/logos/open-router.svg" />}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="integration-openrouter-key">{t('API key')}</Label>
              <Input id="integration-openrouter-key" name="openrouter_api_key" type="password" autoComplete="off" maxLength={256} value={openRouterApiKey} onChange={event => setOpenRouterApiKey(event.target.value)} disabled={isPending} placeholder={props.openRouterSettings.isApiKeyConfigured && !openRouterApiKey ? '••••••••••••••••' : t('Enter OpenRouter API key')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="integration-openrouter-model">{t('Preferred OpenRouter model')}</Label>
              <div className="flex gap-2">
                <Select value={openRouterModel || AUTOMATIC_MODEL_VALUE} onValueChange={value => setOpenRouterModel(value === AUTOMATIC_MODEL_VALUE ? '' : value)} disabled={isPending || (!props.openRouterSettings.isApiKeyConfigured && !openRouterApiKey.trim())}>
                  <SelectTrigger id="integration-openrouter-model" className="h-12! w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTOMATIC_MODEL_VALUE}>{t('Let OpenRouter decide')}</SelectItem>
                    {openRouterModelOptions.map(model => <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" size="icon" className="size-12 shrink-0" disabled={!openRouterApiKey.trim() || isPending || isRefreshingOpenRouterModels} onClick={refreshOpenRouterModels} aria-label={t('Refresh models')}>
                  <RefreshCwIcon className={cn('size-4', isRefreshingOpenRouterModels && 'animate-spin')} />
                </Button>
              </div>
              {openRouterModelsError && <p className="text-xs text-destructive">{openRouterModelsError}</p>}
            </div>
            <OfficialLink href="https://openrouter.ai/settings/keys">{t('Create an API key on the official OpenRouter site')}</OfficialLink>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="sumsub"
          isOpen={visibleOpenSections.has('sumsub')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="Sumsub" description={t('Verify user identities and manage KYC requirements with Sumsub.')} logo="/images/logos/sumsub.svg" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 md:col-span-2">
              <Label htmlFor="integration-sumsub-enabled">{t('Enable Sumsub')}</Label>
              <Switch id="integration-sumsub-enabled" checked={sumsubEnabled} onCheckedChange={setSumsubEnabled} disabled={isPending} />
            </div>
            {[
              ['integration-sumsub-app-token', 'sumsub_app_token', t('App Token'), sumsubAppToken, setSumsubAppToken, props.sumsubSettings.appTokenConfigured],
              ['integration-sumsub-secret-key', 'sumsub_secret_key', t('Secret Key'), sumsubSecretKey, setSumsubSecretKey, props.sumsubSettings.secretKeyConfigured],
              ['integration-sumsub-webhook-secret', 'sumsub_webhook_secret', t('Webhook Secret'), sumsubWebhookSecret, setSumsubWebhookSecret, props.sumsubSettings.webhookSecretConfigured],
            ].map(([id, name, label, value, onChange, configured]) => (
              <div key={String(id)} className="grid gap-2">
                <Label htmlFor={String(id)}>{String(label)}</Label>
                <Input id={String(id)} name={String(name)} type="password" autoComplete="off" maxLength={512} value={String(value)} onChange={event => (onChange as (value: string) => void)(event.target.value)} disabled={isPending} placeholder={configured && !value ? '••••••••••••••••' : undefined} />
              </div>
            ))}
            <div className="grid gap-2">
              <Label htmlFor="integration-sumsub-level">{t('Verification Level Name')}</Label>
              <Input id="integration-sumsub-level" name="sumsub_level_name" maxLength={128} value={sumsubLevelName} onChange={event => setSumsubLevelName(event.target.value)} disabled={isPending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="integration-sumsub-enforcement">{t('Enforcement')}</Label>
              <Select value={sumsubEnforcement} onValueChange={value => setSumsubEnforcement(value as SumsubEnforcement)} disabled={isPending}>
                <SelectTrigger id="integration-sumsub-enforcement"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">{t('Disabled')}</SelectItem>
                  <SelectItem value="observe">{t('Observe only')}</SelectItem>
                  <SelectItem value="required">{t('Required')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Button type="button" variant="secondary" className="w-fit" disabled={!canTestSumsub || isPending || isTestingSumsub} onClick={testSumsubConnection}>
                <RefreshCwIcon className={cn('size-4', isTestingSumsub && 'animate-spin')} />
                {isTestingSumsub ? t('Testing...') : t('Test connection')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('Webhook Secret is validated only when a real webhook is received.')}</p>
              <OfficialLink href="https://cockpit.sumsub.com">{t('Open the official Sumsub dashboard')}</OfficialLink>
            </div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="thesportsdb"
          isOpen={visibleOpenSections.has('thesportsdb')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="TheSportsDB" description={t('Import traditional sports schedules, teams, and scores from TheSportsDB.')} logo="/images/logos/thesportsdb.svg" />}
        >
          <div className="grid gap-2">
            <Label htmlFor="integration-thesportsdb-key">{t('TheSportsDB API key')}</Label>
            <Input id="integration-thesportsdb-key" name="sports_thesportsdb_api_key" type="password" autoComplete="off" maxLength={512} value={theSportsDbApiKey} onChange={event => setTheSportsDbApiKey(event.target.value)} disabled={isPending} placeholder={props.sportsSourceSettings.isTheSportsDbApiKeyConfigured && !theSportsDbApiKey ? '••••••••••••••••' : t('Optional')} />
            <OfficialLink href="https://www.thesportsdb.com/api.php">{t('Get an API key on the official TheSportsDB site')}</OfficialLink>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="pandascore"
          isOpen={visibleOpenSections.has('pandascore')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="PandaScore" description={t('Import esports schedules, teams, and results from PandaScore.')} logo="/images/logos/pandascore.svg" />}
        >
          <div className="grid gap-2">
            <Label htmlFor="integration-pandascore-token">{t('PandaScore token')}</Label>
            <Input id="integration-pandascore-token" name="sports_pandascore_token" type="password" autoComplete="off" maxLength={512} value={pandaScoreToken} onChange={event => setPandaScoreToken(event.target.value)} disabled={isPending} placeholder={props.sportsSourceSettings.isPandaScoreTokenConfigured && !pandaScoreToken ? '••••••••••••••••' : t('Optional')} />
            <OfficialLink href="https://app.pandascore.co">{t('Get an API token on the official PandaScore site')}</OfficialLink>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="lifi"
          isOpen={visibleOpenSections.has('lifi')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="LI.FI" description={t('Route cross-chain swaps and deposits through LI.FI.')} logo="/images/logos/lifi.svg" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="integration-lifi-integrator">{t('Integrator name')}</Label>
              <Input id="integration-lifi-integrator" name="lifi_integrator" maxLength={120} value={lifiIntegrator} onChange={event => setLifiIntegrator(event.target.value)} disabled={isPending} placeholder={t('your-app-id (optional)')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="integration-lifi-key">{t('API key')}</Label>
              <Input id="integration-lifi-key" name="lifi_api_key" type="password" autoComplete="off" maxLength={256} value={lifiApiKey} onChange={event => setLifiApiKey(event.target.value)} disabled={isPending} placeholder={props.lifiApiKeyConfigured && !lifiApiKey ? '••••••••••••••••' : t('Enter API key (optional)')} />
            </div>
            <div className="md:col-span-2"><OfficialLink href="https://portal.li.fi">{t('Create credentials on the official LI.FI site')}</OfficialLink></div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="polymarket"
          isOpen={visibleOpenSections.has('polymarket')}
          onToggle={toggleSection}
          header={<IntegrationHeader title="Polymarket" description={t('Compare mirrored markets and enable arbitrage trading with Polymarket.')} logo="/images/logos/polymarket-icon-black.svg" />}
        >
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="integration-arbitrage-enabled">{t('Arbitrage with Polymarket')}</Label>
              <Switch id="integration-arbitrage-enabled" checked={arbitrageEnabled} onCheckedChange={setArbitrageEnabled} disabled={isPending} />
            </div>
            {arbitrageEnabled && (
              <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div className="grid gap-1">
                  <Label htmlFor="integration-arbitrage-multi-wallet">{t('Separate Polymarket wallets')}</Label>
                  <p className="text-xs text-muted-foreground">{t('Allow users to connect a different wallet for Polymarket. Requires a Reown Pro or Enterprise plan with Multi-Wallet enabled in Reown Cloud.')}</p>
                </div>
                <Switch id="integration-arbitrage-multi-wallet" checked={arbitrageMultiWalletEnabled} onCheckedChange={setArbitrageMultiWalletEnabled} disabled={isPending} />
              </div>
            )}
            <OfficialLink href="https://polymarket.com">{t('Open the official Polymarket site')}</OfficialLink>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="kuest-support"
          isOpen={visibleOpenSections.has('kuest-support')}
          onToggle={toggleSection}
          header={(
            <IntegrationHeader
              title="Kuest Support"
              description={t({
                id: 'adminIntegrations.kuestSupportDescription',
                message: 'Offer direct support from every admin page.',
              })}
              logo="/images/logos/kuest-icon.svg"
            />
          )}
        >
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="integration-kuest-support-enabled">
                {t({
                  id: 'adminIntegrations.enableKuestSupport',
                  message: 'Enable Kuest Support',
                })}
              </Label>
              <Switch
                id="integration-kuest-support-enabled"
                checked={kuestSupportEnabled}
                onCheckedChange={setKuestSupportEnabled}
                disabled={isPending}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-4">
              <Label htmlFor="integration-kuest-support-position">
                {t({
                  id: 'adminIntegrations.widgetPosition',
                  message: 'Widget position',
                })}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t({ id: 'adminIntegrations.left', message: 'Left' })}
                </span>
                <Switch
                  id="integration-kuest-support-position"
                  checked={kuestSupportPosition === 'right'}
                  onCheckedChange={checked => setKuestSupportPosition(checked ? 'right' : 'left')}
                  disabled={isPending}
                  aria-label={t({
                    id: 'adminIntegrations.widgetPosition',
                    message: 'Widget position',
                  })}
                />
                <span className="text-xs text-muted-foreground">
                  {t({ id: 'adminIntegrations.right', message: 'Right' })}
                </span>
              </div>
            </div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="custom"
          isOpen={visibleOpenSections.has('custom')}
          onToggle={toggleSection}
          header={<IntegrationHeader title={t('Custom Integrations')} description={t('Add third-party JavaScript for chat, analytics, support, and other tools.')} customIcon />}
        >
          <div className="grid gap-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" disabled={isPending || customJavascriptCodes.length >= MAX_CUSTOM_JAVASCRIPT_CODES} onClick={() => setCustomJavascriptCodes(previous => [...previous, { id: `custom-integration-${Date.now()}`, name: '', snippet: '', disabledOn: [] }])}>{t('Add Integration')}</Button>
            </div>
            {customJavascriptCodes.map((code, index) => (
              <div key={code.id} className="grid gap-4 rounded-xl border bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">{code.name.trim() || `${t('Script')} ${index + 1}`}</h4>
                  <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setCustomJavascriptCodes(previous => previous.filter((_, codeIndex) => codeIndex !== index))}>{t('Remove')}</Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`custom-name-${code.id}`}>{t('Name')}</Label>
                  <Input id={`custom-name-${code.id}`} value={code.name} onChange={event => updateCustomCode(index, current => ({ ...current, name: event.target.value }))} disabled={isPending} maxLength={MAX_CUSTOM_JAVASCRIPT_CODE_NAME_LENGTH} placeholder={t('Support widget')} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`custom-snippet-${code.id}`}>{t('Paste your JavaScript snippet here')}</Label>
                  <Textarea
                    id={`custom-snippet-${code.id}`}
                    value={code.snippet}
                    onChange={event => updateCustomCode(index, current => ({ ...current, snippet: event.target.value }))}
                    disabled={isPending}
                    rows={6}
                    maxLength={MAX_CUSTOM_JAVASCRIPT_CODE_SNIPPET_LENGTH}
                    placeholder={'<script src="https://..."></script>'}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('Disable on')}</Label>
                  <div className="flex flex-wrap gap-3">
                    {customDisablePageOptions.map(option => (
                      <label
                        key={option.value}
                        className={cn(`flex min-w-32 items-center gap-2 rounded-lg border px-3 py-2 text-sm`, code.disabledOn.includes(option.value) && `
                          border-primary/50 bg-primary/5
                        `)}
                      >
                        <Checkbox checked={code.disabledOn.includes(option.value)} disabled={isPending} onCheckedChange={checked => toggleCustomDisabledOn(index, option.value, checked === true)} />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SettingsAccordionSection>
      </div>

      {state.error && <InputError message={state.error} />}
      <Button type="submit" className="ms-auto w-full sm:w-40" disabled={isPending}>
        {isPending ? t('Saving...') : t('Save settings')}
      </Button>
    </form>
  )
}

export default function AdminIntegrationsForm(props: AdminIntegrationsFormProps) {
  return (
    <AdminIntegrationsFormInner
      key={`${props.kuestSupportSettings.enabled}:${props.kuestSupportSettings.position}`}
      {...props}
    />
  )
}
