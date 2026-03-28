'use client'

import type { ReactNode } from 'react'
import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { ChevronDownIcon, ImageUp, RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateGeneralSettingsAction } from '@/app/[locale]/admin/(general)/_actions/update-general-settings'
import AllowedMarketCreatorsManager from '@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface SettingsAccordionSectionProps {
  value: string
  header: ReactNode
  children: ReactNode
  className?: string
  isOpen: boolean
  onToggle: (value: string) => void
}

function SettingsAccordionSection({
  value,
  header,
  children,
  className,
  isOpen,
  onToggle,
}: SettingsAccordionSectionProps) {
  const contentId = useId()

  return (
    <section
      data-settings-section={value}
      data-state={isOpen ? 'open' : 'closed'}
      className={cn(
        `overflow-hidden rounded-xl border bg-background transition-all duration-500 ease-in-out last:border-b`,
        className,
      )}
    >
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        onClick={() => onToggle(value)}
        className="
          flex h-18 w-full items-center justify-between gap-4 px-4 py-0 text-left transition-colors
          hover:bg-muted/50 hover:no-underline
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
          focus-visible:outline-none
        "
      >
        {header}
        <ChevronDownIcon
          className={cn(
            'size-6 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid min-h-0 transition-[grid-template-rows] duration-200 ease-out',
          isOpen
            ? 'grid-rows-[1fr]'
            : 'grid-rows-[0fr]',
        )}
      >
        <div
          id={contentId}
          aria-hidden={!isOpen}
          className={cn('min-h-0 overflow-hidden', isOpen && 'border-t border-border/30')}
        >
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AdminGeneralSettingsForm({
  initialThemeSiteSettings,
  openRouterSettings,
}: AdminGeneralSettingsFormProps) {
  const t = useExtracted()
  const initialSiteName = initialThemeSiteSettings.siteName
  const initialSiteDescription = initialThemeSiteSettings.siteDescription
  const initialLogoMode = initialThemeSiteSettings.logoMode
  const initialLogoSvg = initialThemeSiteSettings.logoSvg
  const initialLogoImagePath = initialThemeSiteSettings.logoImagePath
  const initialLogoImageUrl = initialThemeSiteSettings.logoImageUrl
  const initialPwaIcon192Path = initialThemeSiteSettings.pwaIcon192Path
  const initialPwaIcon512Path = initialThemeSiteSettings.pwaIcon512Path
  const initialPwaIcon192Url = initialThemeSiteSettings.pwaIcon192Url
  const initialPwaIcon512Url = initialThemeSiteSettings.pwaIcon512Url
  const initialGoogleAnalyticsId = initialThemeSiteSettings.googleAnalyticsId
  const initialDiscordLink = initialThemeSiteSettings.discordLink
  const initialTwitterLink = initialThemeSiteSettings.twitterLink
  const initialFacebookLink = initialThemeSiteSettings.facebookLink
  const initialInstagramLink = initialThemeSiteSettings.instagramLink
  const initialTiktokLink = initialThemeSiteSettings.tiktokLink
  const initialLinkedinLink = initialThemeSiteSettings.linkedinLink
  const initialYoutubeLink = initialThemeSiteSettings.youtubeLink
  const initialSupportUrl = initialThemeSiteSettings.supportUrl
  const initialFeeRecipientWallet = initialThemeSiteSettings.feeRecipientWallet
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
  const [pwaIcon192Path, setPwaIcon192Path] = useState(initialPwaIcon192Path)
  const [pwaIcon512Path, setPwaIcon512Path] = useState(initialPwaIcon512Path)
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(initialGoogleAnalyticsId)
  const [discordLink, setDiscordLink] = useState(initialDiscordLink)
  const [twitterLink, setTwitterLink] = useState(initialTwitterLink)
  const [facebookLink, setFacebookLink] = useState(initialFacebookLink)
  const [instagramLink, setInstagramLink] = useState(initialInstagramLink)
  const [tiktokLink, setTiktokLink] = useState(initialTiktokLink)
  const [linkedinLink, setLinkedinLink] = useState(initialLinkedinLink)
  const [youtubeLink, setYoutubeLink] = useState(initialYoutubeLink)
  const [supportUrl, setSupportUrl] = useState(initialSupportUrl)
  const [feeRecipientWallet, setFeeRecipientWallet] = useState(initialFeeRecipientWallet)
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
  const [pwaIcon192PreviewUrl, setPwaIcon192PreviewUrl] = useState<string | null>(null)
  const [pwaIcon512PreviewUrl, setPwaIcon512PreviewUrl] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<string[]>([])

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
    setPwaIcon192Path(initialPwaIcon192Path)
  }, [initialPwaIcon192Path])

  useEffect(() => {
    setPwaIcon512Path(initialPwaIcon512Path)
  }, [initialPwaIcon512Path])

  useEffect(() => {
    setGoogleAnalyticsId(initialGoogleAnalyticsId)
  }, [initialGoogleAnalyticsId])

  useEffect(() => {
    setDiscordLink(initialDiscordLink)
  }, [initialDiscordLink])

  useEffect(() => {
    setTwitterLink(initialTwitterLink)
  }, [initialTwitterLink])

  useEffect(() => {
    setFacebookLink(initialFacebookLink)
  }, [initialFacebookLink])

  useEffect(() => {
    setInstagramLink(initialInstagramLink)
  }, [initialInstagramLink])

  useEffect(() => {
    setTiktokLink(initialTiktokLink)
  }, [initialTiktokLink])

  useEffect(() => {
    setLinkedinLink(initialLinkedinLink)
  }, [initialLinkedinLink])

  useEffect(() => {
    setYoutubeLink(initialYoutubeLink)
  }, [initialYoutubeLink])

  useEffect(() => {
    setSupportUrl(initialSupportUrl)
  }, [initialSupportUrl])

  useEffect(() => {
    setFeeRecipientWallet(initialFeeRecipientWallet)
  }, [initialFeeRecipientWallet])

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
      if (pwaIcon192PreviewUrl) {
        URL.revokeObjectURL(pwaIcon192PreviewUrl)
      }
      if (pwaIcon512PreviewUrl) {
        URL.revokeObjectURL(pwaIcon512PreviewUrl)
      }
    }
  }, [logoPreviewUrl, pwaIcon192PreviewUrl, pwaIcon512PreviewUrl])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success(t('Settings saved successfully!'))
      router.refresh()
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [isPending, router, state.error, t])

  const imagePreview = useMemo(() => {
    return logoPreviewUrl ?? initialLogoImageUrl
  }, [initialLogoImageUrl, logoPreviewUrl])
  const pwaIcon192Preview = useMemo(() => {
    return pwaIcon192PreviewUrl ?? initialPwaIcon192Url
  }, [initialPwaIcon192Url, pwaIcon192PreviewUrl])
  const pwaIcon512Preview = useMemo(() => {
    return pwaIcon512PreviewUrl ?? initialPwaIcon512Url
  }, [initialPwaIcon512Url, pwaIcon512PreviewUrl])

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

  function toggleSection(value: string) {
    setOpenSections((previous) => {
      if (previous.includes(value)) {
        return previous.filter(section => section !== value)
      }

      return [...previous, value]
    })
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
        setOpenRouterModelsError(payload?.error ?? t('Unable to load models. Please verify the API key.'))
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
      setOpenRouterModelsError(t('Unable to load models. Please verify the API key.'))
    }
    finally {
      setIsRefreshingOpenRouterModels(false)
    }
  }

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />
      <input type="hidden" name="logo_svg" value={logoSvg} />
      <input type="hidden" name="pwa_icon_192_path" value={pwaIcon192Path} />
      <input type="hidden" name="pwa_icon_512_path" value={pwaIcon512Path} />
      <input type="hidden" name="openrouter_model" value={openRouterModel} />

      <div className="grid gap-6">
        <SettingsAccordionSection
          value="brand-identity"
          isOpen={openSections.includes('brand-identity')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Brand identity')}</h3>}
        >
          <div className="grid gap-6">
            <div className="grid gap-6 md:grid-cols-[11rem_1fr]">
              <div className="grid gap-3">
                <Label>{t('Logo icon')}</Label>
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
                        group relative flex size-40 cursor-pointer items-center justify-center overflow-hidden
                        rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground transition
                        hover:border-primary/60
                      `,
                      { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
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
                        alt={t('Platform logo')}
                        fill
                        sizes="160px"
                        className="object-contain"
                        unoptimized
                      />
                    )}
                    {!showImagePreview && showSvgPreview && (
                      <Image
                        src={svgPreviewUrl}
                        alt={t('Platform logo')}
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
                      {t('SVG, PNG, JPG or WebP')}
                    </span>
                  </label>
                </div>
                {selectedLogoFile && (
                  <p className="text-xs text-muted-foreground">
                    {t('Selected file:')}
                    {' '}
                    {selectedLogoFile.name}
                  </p>
                )}
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="theme-site-name">{t('Company name')}</Label>
                  <Input
                    id="theme-site-name"
                    name="site_name"
                    maxLength={80}
                    value={siteName}
                    onChange={event => setSiteName(event.target.value)}
                    disabled={isPending}
                    placeholder={t('Your company name')}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="theme-site-description">{t('Company description')}</Label>
                  <Input
                    id="theme-site-description"
                    name="site_description"
                    maxLength={180}
                    value={siteDescription}
                    onChange={event => setSiteDescription(event.target.value)}
                    disabled={isPending}
                    placeholder={t('Short description used in metadata and wallet dialogs')}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-border/50 pt-6">
              <h4 className="text-sm font-medium">{t('App install icon (PWA)')}</h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t('Icon 192x192')}</Label>
                  <Input
                    id="theme-pwa-icon-192-file"
                    type="file"
                    name="pwa_icon_192"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={isPending}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      if (pwaIcon192PreviewUrl) {
                        URL.revokeObjectURL(pwaIcon192PreviewUrl)
                      }
                      setPwaIcon192PreviewUrl(file ? URL.createObjectURL(file) : null)
                    }}
                  />
                  <label
                    htmlFor="theme-pwa-icon-192-file"
                    className={cn(
                      `
                        group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden
                        rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground transition
                        hover:border-primary/60
                      `,
                      { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
                    )}
                  >
                    <span className={`
                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                      group-hover:bg-foreground/5
                    `}
                    />
                    <Image
                      src={pwaIcon192Preview}
                      alt={t('PWA icon 192x192')}
                      fill
                      sizes="112px"
                      className="object-contain"
                      unoptimized
                    />
                    <ImageUp
                      className={cn(
                        `
                          pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2 text-foreground/70
                          opacity-0 transition
                          group-hover:opacity-100
                        `,
                      )}
                    />
                    <span
                      className={`
                        pointer-events-none absolute bottom-1.5 left-1/2 z-10 w-20 -translate-x-1/2 rounded-md
                        bg-background/80 px-1.5 py-0.5 text-center text-2xs leading-tight font-medium
                        text-muted-foreground opacity-0 transition
                        group-hover:opacity-100
                      `}
                    >
                      {t('PNG, JPG, WebP or SVG')}
                    </span>
                  </label>
                </div>

                <div className="grid gap-2">
                  <Label>{t('Icon 512x512')}</Label>
                  <Input
                    id="theme-pwa-icon-512-file"
                    type="file"
                    name="pwa_icon_512"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={isPending}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      if (pwaIcon512PreviewUrl) {
                        URL.revokeObjectURL(pwaIcon512PreviewUrl)
                      }
                      setPwaIcon512PreviewUrl(file ? URL.createObjectURL(file) : null)
                    }}
                  />
                  <label
                    htmlFor="theme-pwa-icon-512-file"
                    className={cn(
                      `
                        group relative flex size-28 cursor-pointer items-center justify-center overflow-hidden
                        rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground transition
                        hover:border-primary/60
                      `,
                      { 'cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/20': isPending },
                    )}
                  >
                    <span className={`
                      pointer-events-none absolute inset-0 bg-foreground/0 transition
                      group-hover:bg-foreground/5
                    `}
                    />
                    <Image
                      src={pwaIcon512Preview}
                      alt={t('PWA icon 512x512')}
                      fill
                      sizes="112px"
                      className="object-contain"
                      unoptimized
                    />
                    <ImageUp
                      className={cn(
                        `
                          pointer-events-none absolute top-1/2 left-1/2 z-10 size-6 -translate-1/2 text-foreground/70
                          opacity-0 transition
                          group-hover:opacity-100
                        `,
                      )}
                    />
                    <span
                      className={`
                        pointer-events-none absolute bottom-1.5 left-1/2 z-10 w-20 -translate-x-1/2 rounded-md
                        bg-background/80 px-1.5 py-0.5 text-center text-2xs leading-tight font-medium
                        text-muted-foreground opacity-0 transition
                        group-hover:opacity-100
                      `}
                    >
                      {t('PNG, JPG, WebP or SVG')}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="community-analytics"
          isOpen={openSections.includes('community-analytics')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Community and analytics')}</h3>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="theme-google-analytics-id">{t('Google Analytics ID')}</Label>
              <Input
                id="theme-google-analytics-id"
                name="google_analytics_id"
                maxLength={120}
                value={googleAnalyticsId}
                onChange={event => setGoogleAnalyticsId(event.target.value)}
                disabled={isPending}
                placeholder={t('G-XXXXXXXXXX (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-discord-link">{t('Discord community link')}</Label>
              <Input
                id="theme-discord-link"
                name="discord_link"
                maxLength={2048}
                value={discordLink}
                onChange={event => setDiscordLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://discord.gg/invite-url (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-twitter-link">{t('X / Twitter link')}</Label>
              <Input
                id="theme-twitter-link"
                name="twitter_link"
                maxLength={2048}
                value={twitterLink}
                onChange={event => setTwitterLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://x.com/your-handle (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-facebook-link">{t('Facebook link')}</Label>
              <Input
                id="theme-facebook-link"
                name="facebook_link"
                maxLength={2048}
                value={facebookLink}
                onChange={event => setFacebookLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://facebook.com/your-page (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-instagram-link">{t('Instagram link')}</Label>
              <Input
                id="theme-instagram-link"
                name="instagram_link"
                maxLength={2048}
                value={instagramLink}
                onChange={event => setInstagramLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://instagram.com/your-handle (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-tiktok-link">{t('TikTok link')}</Label>
              <Input
                id="theme-tiktok-link"
                name="tiktok_link"
                maxLength={2048}
                value={tiktokLink}
                onChange={event => setTiktokLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://tiktok.com/@your-handle (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-linkedin-link">{t('LinkedIn link')}</Label>
              <Input
                id="theme-linkedin-link"
                name="linkedin_link"
                maxLength={2048}
                value={linkedinLink}
                onChange={event => setLinkedinLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://linkedin.com/company/your-company (optional)')}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="theme-youtube-link">{t('YouTube link')}</Label>
              <Input
                id="theme-youtube-link"
                name="youtube_link"
                maxLength={2048}
                value={youtubeLink}
                onChange={event => setYoutubeLink(event.target.value)}
                disabled={isPending}
                placeholder={t('https://youtube.com/@your-channel (optional)')}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="theme-support-link">{t('Support link')}</Label>
              <Input
                id="theme-support-link"
                name="support_url"
                maxLength={2048}
                value={supportUrl}
                onChange={event => setSupportUrl(event.target.value)}
                disabled={isPending}
                placeholder={t('Discord, Telegram, WhatsApp link, or support email (optional)')}
              />
            </div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="openrouter"
          isOpen={openSections.includes('openrouter')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('OpenRouter integration')}</h3>}
        >
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="openrouter_key">{t('API key')}</Label>
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
                  onValueChange={handleOpenRouterModelChange}
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
                  onClick={handleRefreshOpenRouterModels}
                  title={t('Refresh models')}
                  aria-label={t('Refresh models')}
                >
                  <RefreshCwIcon className={cn('size-4', { 'animate-spin': isRefreshingOpenRouterModels })} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('Models with live browsing (for example')}
                {' '}
                <code>perplexity/sonar</code>
                {t(') perform best. Explore available models at')}
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
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="lifi"
          isOpen={openSections.includes('lifi')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('LI.FI integration')}</h3>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="theme-lifi-integrator">{t('Integrator name')}</Label>
              <Input
                id="theme-lifi-integrator"
                name="lifi_integrator"
                maxLength={120}
                value={lifiIntegrator}
                onChange={event => setLifiIntegrator(event.target.value)}
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
                onChange={event => setLifiApiKey(event.target.value)}
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
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="market-fees"
          isOpen={openSections.includes('market-fees')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Market and fee settings')}</h3>}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="theme-fee-recipient-wallet">{t('Your Polygon wallet address to receive transaction fees')}</Label>
              <Input
                id="theme-fee-recipient-wallet"
                name="fee_recipient_wallet"
                maxLength={42}
                value={feeRecipientWallet}
                onChange={event => setFeeRecipientWallet(event.target.value)}
                disabled={isPending}
                placeholder={t('0xabc')}
              />
            </div>

            <AllowedMarketCreatorsManager disabled={isPending} />
          </div>
        </SettingsAccordionSection>

      </div>

      {state.error && <InputError message={state.error} />}

      <div className="flex justify-end">
        <Button type="submit" className="w-full sm:w-40" disabled={isPending}>
          {isPending ? t('Saving...') : t('Save settings')}
        </Button>
      </div>
    </form>
  )
}
