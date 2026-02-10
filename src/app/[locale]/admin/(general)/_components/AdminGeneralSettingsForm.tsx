'use client'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { CircleHelp, ImageUp, RefreshCwIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateGeneralSettingsAction } from '@/app/[locale]/admin/(general)/_actions/update-general-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, sanitizeSvg } from '@/lib/utils'

const initialState = {
  error: null,
}

const AUTOMATIC_MODEL_VALUE = '__AUTOMATIC__'

interface ModelOption {
  id: string
  label: string
  contextWindow?: number
}

interface OpenRouterGeneralSettings {
  defaultModel?: string
  isApiKeyConfigured: boolean
  isModelSelectEnabled: boolean
  modelOptions: ModelOption[]
  modelsError?: string
}

interface AdminGeneralSettingsFormProps {
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
  openRouterSettings: OpenRouterGeneralSettings
}

export default function AdminGeneralSettingsForm({
  initialThemeSiteSettings,
  openRouterSettings,
}: AdminGeneralSettingsFormProps) {
  const initialSiteName = initialThemeSiteSettings.siteName
  const initialSiteDescription = initialThemeSiteSettings.siteDescription
  const initialLogoMode = initialThemeSiteSettings.logoMode
  const initialLogoSvg = initialThemeSiteSettings.logoSvg
  const initialLogoImagePath = initialThemeSiteSettings.logoImagePath
  const initialLogoImageUrl = initialThemeSiteSettings.logoImageUrl
  const initialGoogleAnalyticsId = initialThemeSiteSettings.googleAnalyticsId
  const initialDiscordLink = initialThemeSiteSettings.discordLink
  const initialSupportUrl = initialThemeSiteSettings.supportUrl
  const initialFeeRecipientWallet = initialThemeSiteSettings.feeRecipientWallet
  const initialMarketCreators = initialThemeSiteSettings.marketCreators
  const initialLiFiIntegrator = initialThemeSiteSettings.lifiIntegrator
  const initialLiFiApiKey = initialThemeSiteSettings.lifiApiKey
  const initialLiFiApiKeyConfigured = initialThemeSiteSettings.lifiApiKeyConfigured
  const initialOpenRouterModel = openRouterSettings.defaultModel ?? ''
  const initialOpenRouterApiKeyConfigured = openRouterSettings.isApiKeyConfigured

  const router = useRouter()
  const [state, formAction, isPending] = useActionState(updateGeneralSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  const [siteName, setSiteName] = useState(initialSiteName)
  const [siteDescription, setSiteDescription] = useState(initialSiteDescription)
  const [logoMode, setLogoMode] = useState(initialLogoMode)
  const [logoSvg, setLogoSvg] = useState(initialLogoSvg)
  const [logoImagePath, setLogoImagePath] = useState(initialLogoImagePath)
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(initialGoogleAnalyticsId)
  const [discordLink, setDiscordLink] = useState(initialDiscordLink)
  const [supportUrl, setSupportUrl] = useState(initialSupportUrl)
  const [feeRecipientWallet, setFeeRecipientWallet] = useState(initialFeeRecipientWallet)
  const [marketCreators, setMarketCreators] = useState(initialMarketCreators)
  const [lifiIntegrator, setLifiIntegrator] = useState(initialLiFiIntegrator)
  const [lifiApiKey, setLifiApiKey] = useState(initialLiFiApiKey)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState(initialOpenRouterModel)
  const [openRouterSelectValue, setOpenRouterSelectValue] = useState(
    initialOpenRouterModel || AUTOMATIC_MODEL_VALUE,
  )
  const [openRouterModelOptions, setOpenRouterModelOptions] = useState<ModelOption[]>(openRouterSettings.modelOptions)
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | undefined>(openRouterSettings.modelsError)
  const [isRefreshingOpenRouterModels, setIsRefreshingOpenRouterModels] = useState(false)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    setSiteName(initialSiteName)
  }, [initialSiteName])

  useEffect(() => {
    setSiteDescription(initialSiteDescription)
  }, [initialSiteDescription])

  useEffect(() => {
    setLogoMode(initialLogoMode)
  }, [initialLogoMode])

  useEffect(() => {
    setLogoSvg(initialLogoSvg)
  }, [initialLogoSvg])

  useEffect(() => {
    setLogoImagePath(initialLogoImagePath)
  }, [initialLogoImagePath])

  useEffect(() => {
    setGoogleAnalyticsId(initialGoogleAnalyticsId)
  }, [initialGoogleAnalyticsId])

  useEffect(() => {
    setDiscordLink(initialDiscordLink)
  }, [initialDiscordLink])

  useEffect(() => {
    setSupportUrl(initialSupportUrl)
  }, [initialSupportUrl])

  useEffect(() => {
    setFeeRecipientWallet(initialFeeRecipientWallet)
  }, [initialFeeRecipientWallet])

  useEffect(() => {
    setMarketCreators(initialMarketCreators)
  }, [initialMarketCreators])

  useEffect(() => {
    setLifiIntegrator(initialLiFiIntegrator)
  }, [initialLiFiIntegrator])

  useEffect(() => {
    setLifiApiKey(initialLiFiApiKey)
  }, [initialLiFiApiKey])

  useEffect(() => {
    setOpenRouterModel(initialOpenRouterModel)
    setOpenRouterSelectValue(initialOpenRouterModel || AUTOMATIC_MODEL_VALUE)
  }, [initialOpenRouterModel])

  useEffect(() => {
    queueMicrotask(() => setOpenRouterModelOptions(openRouterSettings.modelOptions))
  }, [openRouterSettings.modelOptions])

  useEffect(() => {
    queueMicrotask(() => {
      setOpenRouterModelsError(previous => (previous === openRouterSettings.modelsError ? previous : openRouterSettings.modelsError))
    })
  }, [openRouterSettings.modelsError])

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success('Settings saved successfully!')
      router.refresh()
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, router, state.error])

  const imagePreview = useMemo(() => {
    return logoPreviewUrl ?? initialLogoImageUrl
  }, [initialLogoImageUrl, logoPreviewUrl])

  const sanitizedLogoSvg = useMemo(() => sanitizeSvg(logoSvg), [logoSvg])
  const svgPreviewUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(sanitizedLogoSvg)}`,
    [sanitizedLogoSvg],
  )

  const showImagePreview = Boolean(imagePreview)
  const showSvgPreview = !showImagePreview && Boolean(sanitizedLogoSvg.trim())
  const trimmedOpenRouterApiKey = openRouterApiKey.trim()
  const openRouterModelSelectEnabled = openRouterSettings.isModelSelectEnabled || Boolean(trimmedOpenRouterApiKey)

  function handleOpenRouterModelChange(nextValue: string) {
    setOpenRouterSelectValue(nextValue)
    setOpenRouterModel(nextValue === AUTOMATIC_MODEL_VALUE ? '' : nextValue)
  }

  async function handleRefreshOpenRouterModels() {
    if (!trimmedOpenRouterApiKey) {
      return
    }

    try {
      setIsRefreshingOpenRouterModels(true)
      setOpenRouterModelsError(undefined)
      const response = await fetch('/admin/api/openrouter-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: trimmedOpenRouterApiKey }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setOpenRouterModelsError(payload?.error ?? 'Unable to load models. Please verify the API key.')
        return
      }

      const payload = await response.json() as { models?: ModelOption[] }
      const refreshedModels = Array.isArray(payload?.models) ? payload.models : []
      setOpenRouterModelOptions(refreshedModels)

      if (openRouterSelectValue !== AUTOMATIC_MODEL_VALUE && refreshedModels.every(model => model.id !== openRouterSelectValue)) {
        setOpenRouterSelectValue(AUTOMATIC_MODEL_VALUE)
        setOpenRouterModel('')
      }
    }
    catch (error) {
      console.error('Failed to refresh OpenRouter models', error)
      setOpenRouterModelsError('Unable to load models. Please verify the API key.')
    }
    finally {
      setIsRefreshingOpenRouterModels(false)
    }
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />
      <input type="hidden" name="logo_svg" value={logoSvg} />
      <input type="hidden" name="openrouter_model" value={openRouterModel} />

      <section className="overflow-hidden rounded-xl border">
        <div className="p-4">
          <h3 className="text-base font-medium">Brand identity</h3>
        </div>

        <div className="border-t p-4">
          <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
            <div className="grid gap-3">
              <Label>Logo icon</Label>
              <div className="grid gap-2">
                <Input
                  id="theme-logo-file"
                  type="file"
                  name="logo_image"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={isPending}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    if (logoPreviewUrl) {
                      URL.revokeObjectURL(logoPreviewUrl)
                    }

                    setSelectedLogoFile(file)

                    if (file) {
                      setLogoPreviewUrl(URL.createObjectURL(file))
                      if (file.type === 'image/svg+xml') {
                        setLogoMode('svg')
                        setLogoImagePath('')
                        void file.text().then((text) => {
                          setLogoSvg(sanitizeSvg(text))
                        })
                      }
                      else {
                        setLogoMode('image')
                      }
                    }
                    else {
                      setLogoPreviewUrl(null)
                      setLogoMode(initialLogoMode)
                    }
                  }}
                />
                <label
                  htmlFor="theme-logo-file"
                  className={cn(
                    `
                      group relative flex size-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl
                      border border-dashed border-border bg-muted/20 text-muted-foreground transition
                      hover:border-primary/60
                    `,
                    isPending ? 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20' : '',
                  )}
                >
                  <span className={`
                    pointer-events-none absolute inset-0 bg-foreground/0 transition
                    group-hover:bg-foreground/5
                  `}
                  />
                  {showImagePreview && (
                    <Image
                      src={imagePreview ?? ''}
                      alt="Platform logo"
                      fill
                      sizes="160px"
                      className="object-contain"
                      unoptimized
                    />
                  )}
                  {!showImagePreview && showSvgPreview && (
                    <Image
                      src={svgPreviewUrl}
                      alt="Platform logo"
                      fill
                      sizes="160px"
                      className="object-contain"
                      unoptimized
                    />
                  )}
                  <ImageUp
                    className={cn(
                      `
                        pointer-events-none absolute top-1/2 left-1/2 z-10 size-7 -translate-1/2 text-foreground/70
                        opacity-0 transition
                        group-hover:opacity-100
                      `,
                    )}
                  />
                  <span
                    className={`
                      pointer-events-none absolute bottom-2 left-1/2 z-10 w-30 -translate-x-1/2 rounded-md
                      bg-background/80 px-2 py-1 text-center text-2xs leading-tight font-medium text-muted-foreground
                      opacity-0 transition
                      group-hover:opacity-100
                    `}
                  >
                    SVG, PNG, JPG or WebP
                  </span>
                </label>
              </div>
              {selectedLogoFile && (
                <p className="text-xs text-muted-foreground">
                  Selected file:
                  {' '}
                  {selectedLogoFile.name}
                </p>
              )}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="theme-site-name">Company name</Label>
                <Input
                  id="theme-site-name"
                  name="site_name"
                  maxLength={80}
                  value={siteName}
                  onChange={event => setSiteName(event.target.value)}
                  disabled={isPending}
                  placeholder="Your company name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="theme-site-description">Company description</Label>
                <Input
                  id="theme-site-description"
                  name="site_description"
                  maxLength={180}
                  value={siteDescription}
                  onChange={event => setSiteDescription(event.target.value)}
                  disabled={isPending}
                  placeholder="Short description used in metadata and wallet dialogs"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="p-4">
          <h3 className="text-base font-medium">Community and analytics</h3>
        </div>

        <div className="border-t p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="theme-google-analytics-id">Google Analytics ID</Label>
              <Input
                id="theme-google-analytics-id"
                name="google_analytics_id"
                maxLength={120}
                value={googleAnalyticsId}
                onChange={event => setGoogleAnalyticsId(event.target.value)}
                disabled={isPending}
                placeholder="G-XXXXXXXXXX (optional)"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-discord-link">Discord community link</Label>
              <Input
                id="theme-discord-link"
                name="discord_link"
                maxLength={2048}
                value={discordLink}
                onChange={event => setDiscordLink(event.target.value)}
                disabled={isPending}
                placeholder="https://discord.gg/invite-url (optional)"
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="theme-support-link">Support link</Label>
              <Input
                id="theme-support-link"
                name="support_url"
                maxLength={2048}
                value={supportUrl}
                onChange={event => setSupportUrl(event.target.value)}
                disabled={isPending}
                placeholder="Discord, Telegram, WhatsApp link, or support email (optional)"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="p-4">
          <div className="flex items-center gap-1">
            <h3 className="text-base font-medium">OpenRouter integration</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="OpenRouter integration help"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                OpenRouter powers AI requests used in market context generation and automatic translations (events and tags).
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="grid gap-6 border-t p-4">
          <div className="grid gap-2">
            <Label htmlFor="openrouter_key">API key</Label>
            <Input
              id="openrouter_key"
              name="openrouter_api_key"
              type="password"
              autoComplete="off"
              maxLength={256}
              value={openRouterApiKey}
              onChange={event => setOpenRouterApiKey(event.target.value)}
              disabled={isPending}
              placeholder={
                initialOpenRouterApiKeyConfigured && !trimmedOpenRouterApiKey
                  ? '••••••••••••••••'
                  : 'Enter OpenRouter API key'
              }
            />
            <p className="text-xs text-muted-foreground">
              Generate an API key at
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
            <Label htmlFor="openrouter_model">Preferred OpenRouter model</Label>
            <div className="flex items-center gap-2">
              <Select
                value={openRouterSelectValue}
                onValueChange={handleOpenRouterModelChange}
                disabled={!openRouterModelSelectEnabled || isPending}
              >
                <SelectTrigger id="openrouter_model" className="h-12! w-full max-w-md justify-between text-left">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTOMATIC_MODEL_VALUE}>
                    Let OpenRouter decide
                  </SelectItem>
                  {openRouterModelOptions.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col gap-0.5">
                        <span>{model.label}</span>
                        {model.contextWindow
                          ? (
                              <span className="text-xs text-muted-foreground">
                                Context window:
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
                onClick={handleRefreshOpenRouterModels}
                title="Refresh models"
                aria-label="Refresh models"
              >
                <RefreshCwIcon className={`size-4 ${isRefreshingOpenRouterModels ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Models with live browsing (for example
              {' '}
              <code>perplexity/sonar</code>
              ) perform best. Explore available models at
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
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="p-4">
          <div className="flex items-center gap-1">
            <h3 className="text-base font-medium">LI.FI integration</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="LI.FI integration help"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                LI.FI powers swap routes and token balances used in trading and deposits. It works without an API key (default: 200 requests per 2 hours). With an API key, the default limit is 200 requests per minute (enforced on a 2-hour rolling window).
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="border-t p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="theme-lifi-integrator">Integrator name</Label>
              <Input
                id="theme-lifi-integrator"
                name="lifi_integrator"
                maxLength={120}
                value={lifiIntegrator}
                onChange={event => setLifiIntegrator(event.target.value)}
                disabled={isPending}
                placeholder="your-app-id (optional)"
              />
              <p className="text-xs text-muted-foreground">
                Create an account and generate one at
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
              <Label htmlFor="theme-lifi-api-key">API key</Label>
              <Input
                id="theme-lifi-api-key"
                name="lifi_api_key"
                type="password"
                autoComplete="off"
                maxLength={256}
                value={lifiApiKey}
                onChange={event => setLifiApiKey(event.target.value)}
                disabled={isPending}
                placeholder={
                  initialLiFiApiKeyConfigured && !lifiApiKey.trim()
                    ? '••••••••••••••••'
                    : 'Enter API key (optional)'
                }
              />
              <p className="invisible text-xs text-muted-foreground" aria-hidden="true">
                Spacer
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <div className="p-4">
          <h3 className="text-base font-medium">Market and fee settings</h3>
        </div>

        <div className="border-t p-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="theme-fee-recipient-wallet">Your Polygon wallet address to receive transaction fees</Label>
              <Input
                id="theme-fee-recipient-wallet"
                name="fee_recipient_wallet"
                maxLength={42}
                value={feeRecipientWallet}
                onChange={event => setFeeRecipientWallet(event.target.value)}
                disabled={isPending}
                placeholder="0xabc"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="theme-market-creators">Allowed market creator wallets (one per line)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="
                        inline-flex size-4 items-center justify-center text-muted-foreground
                        hover:text-foreground
                      "
                      aria-label="Market creator wallets help"
                    >
                      <CircleHelp className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left">
                    Markets from these addresses will only appear on this fork&apos;s site. Leave empty to only show main Kuest markets.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="theme-market-creators"
                name="market_creators"
                rows={4}
                maxLength={8000}
                value={marketCreators}
                onChange={event => setMarketCreators(event.target.value)}
                disabled={isPending}
                placeholder={'0xabc...\n0xdef...'}
              />
            </div>
          </div>
        </div>
      </section>

      {state.error && <InputError message={state.error} />}

      <div className="flex justify-end">
        <Button type="submit" className="w-full sm:w-40" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
    </form>
  )
}
