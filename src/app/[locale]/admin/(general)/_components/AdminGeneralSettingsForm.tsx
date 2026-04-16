'use client'

import type { ReactNode } from 'react'
import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import type { CustomJavascriptCodeConfig, CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import { ChevronDownIcon, ImageUp, RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  removeTermsOfServicePdfAction,
  updateGeneralSettingsAction,
} from '@/app/[locale]/admin/(general)/_actions/update-general-settings'
import AllowedMarketCreatorsManager from '@/app/[locale]/admin/(general)/_components/AllowedMarketCreatorsManager'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  MAX_CUSTOM_JAVASCRIPT_CODE_NAME_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODE_SNIPPET_LENGTH,
  MAX_CUSTOM_JAVASCRIPT_CODES,
  serializeCustomJavascriptCodes,
} from '@/lib/custom-javascript-code'
import { cn, sanitizeSvg } from '@/lib/utils'

const initialState = {
  error: null,
}

const AUTOMATIC_MODEL_VALUE = '__AUTOMATIC__'
const MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH = 220
const MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH = 2048

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

interface InitialGlobalAnnouncementSettings {
  message: string
  linkUrl: string
  disabledOn: CustomJavascriptCodeDisablePage[]
}

interface AdminGeneralSettingsFormProps {
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
  initialGlobalAnnouncement: InitialGlobalAnnouncementSettings
  initialTermsOfServicePdfPath: string
  initialTermsOfServicePdfUrl: string | null
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

interface CustomJavascriptCodeDraft extends CustomJavascriptCodeConfig {
  id: string
}

function createCustomJavascriptCodeDraft(id: number, code: CustomJavascriptCodeConfig): CustomJavascriptCodeDraft {
  return {
    id: `custom-javascript-code-${id}`,
    ...code,
  }
}

function toCustomJavascriptCodeConfig({ id: _id, ...code }: CustomJavascriptCodeDraft): CustomJavascriptCodeConfig {
  return code
}

function useSettingsAccordionSectionId() {
  const contentId = useId()
  return contentId
}

function SettingsAccordionSection({
  value,
  header,
  children,
  className,
  isOpen,
  onToggle,
}: SettingsAccordionSectionProps) {
  const contentId = useSettingsAccordionSectionId()

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

function useGeneralSettingsFormState({
  initialThemeSiteSettings,
  initialGlobalAnnouncement,
  initialTermsOfServicePdfPath,
  openRouterSettings,
}: {
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
  initialGlobalAnnouncement: InitialGlobalAnnouncementSettings
  initialTermsOfServicePdfPath: string
  openRouterSettings: OpenRouterGeneralSettings
}) {
  const t = useExtracted()
  const initialLogoMode = initialThemeSiteSettings.logoMode
  const initialLogoImageUrl = initialThemeSiteSettings.logoImageUrl
  const initialPwaIcon192Url = initialThemeSiteSettings.pwaIcon192Url
  const initialPwaIcon512Url = initialThemeSiteSettings.pwaIcon512Url
  const initialCustomJavascriptCodes = initialThemeSiteSettings.customJavascriptCodes
  const initialOpenRouterModel = openRouterSettings.defaultModel ?? ''

  const router = useRouter()
  const [state, formAction, isPending] = useActionState(updateGeneralSettingsAction, initialState)
  const [isRemovingTermsOfServicePdf, startRemovingTermsOfServicePdf] = useTransition()
  const wasPendingRef = useRef(isPending)
  const nextCustomJavascriptCodeIdRef = useRef(0)

  const [siteName, setSiteName] = useState(initialThemeSiteSettings.siteName)
  const [siteDescription, setSiteDescription] = useState(initialThemeSiteSettings.siteDescription)
  const [logoMode, setLogoMode] = useState(initialLogoMode)
  const [logoSvg, setLogoSvg] = useState(initialThemeSiteSettings.logoSvg)
  const [logoImagePath, setLogoImagePath] = useState(initialThemeSiteSettings.logoImagePath)
  const [pwaIcon192Path] = useState(initialThemeSiteSettings.pwaIcon192Path)
  const [pwaIcon512Path] = useState(initialThemeSiteSettings.pwaIcon512Path)
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(initialThemeSiteSettings.googleAnalyticsId)
  const [discordLink, setDiscordLink] = useState(initialThemeSiteSettings.discordLink)
  const [twitterLink, setTwitterLink] = useState(initialThemeSiteSettings.twitterLink)
  const [facebookLink, setFacebookLink] = useState(initialThemeSiteSettings.facebookLink)
  const [instagramLink, setInstagramLink] = useState(initialThemeSiteSettings.instagramLink)
  const [tiktokLink, setTiktokLink] = useState(initialThemeSiteSettings.tiktokLink)
  const [linkedinLink, setLinkedinLink] = useState(initialThemeSiteSettings.linkedinLink)
  const [youtubeLink, setYoutubeLink] = useState(initialThemeSiteSettings.youtubeLink)
  const [supportUrl, setSupportUrl] = useState(initialThemeSiteSettings.supportUrl)
  const [globalAnnouncementMessage, setGlobalAnnouncementMessage] = useState(initialGlobalAnnouncement.message)
  const [globalAnnouncementLinkUrl, setGlobalAnnouncementLinkUrl] = useState(initialGlobalAnnouncement.linkUrl)
  const [globalAnnouncementDisabledOn, setGlobalAnnouncementDisabledOn] = useState<CustomJavascriptCodeDisablePage[]>(
    initialGlobalAnnouncement.disabledOn,
  )
  const [customJavascriptCodes, setCustomJavascriptCodes] = useState<CustomJavascriptCodeDraft[]>(
    () => initialCustomJavascriptCodes.map(code => createCustomJavascriptCodeDraft(nextCustomJavascriptCodeIdRef.current++, code)),
  )
  const [feeRecipientWallet, setFeeRecipientWallet] = useState(initialThemeSiteSettings.feeRecipientWallet)
  const [tosPdfPath, setTosPdfPath] = useState(initialTermsOfServicePdfPath)
  const [lifiIntegrator, setLifiIntegrator] = useState(initialThemeSiteSettings.lifiIntegrator)
  const [lifiApiKey, setLifiApiKey] = useState(initialThemeSiteSettings.lifiApiKey)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState(initialOpenRouterModel)
  const [openRouterSelectValue, setOpenRouterSelectValue] = useState(
    initialOpenRouterModel || AUTOMATIC_MODEL_VALUE,
  )
  const [openRouterModelOptions, setOpenRouterModelOptions] = useState<ModelOption[]>(openRouterSettings.modelOptions)
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | undefined>(openRouterSettings.modelsError)
  const [isRefreshingOpenRouterModels, setIsRefreshingOpenRouterModels] = useState(false)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [selectedTermsOfServicePdfFile, setSelectedTermsOfServicePdfFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [pwaIcon192PreviewUrl, setPwaIcon192PreviewUrl] = useState<string | null>(null)
  const [pwaIcon512PreviewUrl, setPwaIcon512PreviewUrl] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<string[]>([])

  useEffect(function revokePreviewUrlsOnChange() {
    const capturedLogoUrl = logoPreviewUrl
    const capturedPwa192Url = pwaIcon192PreviewUrl
    const capturedPwa512Url = pwaIcon512PreviewUrl
    return function revokeUrls() {
      if (capturedLogoUrl) {
        URL.revokeObjectURL(capturedLogoUrl)
      }
      if (capturedPwa192Url) {
        URL.revokeObjectURL(capturedPwa192Url)
      }
      if (capturedPwa512Url) {
        URL.revokeObjectURL(capturedPwa512Url)
      }
    }
  }, [logoPreviewUrl, pwaIcon192PreviewUrl, pwaIcon512PreviewUrl])

  useEffect(function toastOnSettingsTransition() {
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
  const serializedCustomJavascriptCodes = useMemo(
    () => serializeCustomJavascriptCodes(customJavascriptCodes.map(toCustomJavascriptCodeConfig)),
    [customJavascriptCodes],
  )
  const serializedGlobalAnnouncementDisabledOn = useMemo(
    () => JSON.stringify(globalAnnouncementDisabledOn),
    [globalAnnouncementDisabledOn],
  )
  const customJavascriptCodeDisablePageOptions = useMemo(() => ([
    { value: 'home' as const, label: t('Home') },
    { value: 'event' as const, label: '/event' },
    { value: 'portfolio' as const, label: '/portfolio' },
    { value: 'settings' as const, label: '/settings' },
    { value: 'docs' as const, label: '/docs' },
    { value: 'admin' as const, label: '/admin' },
  ]), [t])

  const sanitizedLogoSvg = useMemo(() => sanitizeSvg(logoSvg), [logoSvg])
  const svgPreviewUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(sanitizedLogoSvg)}`,
    [sanitizedLogoSvg],
  )

  return {
    router,
    state,
    formAction,
    isPending,
    isRemovingTermsOfServicePdf,
    startRemovingTermsOfServicePdf,
    nextCustomJavascriptCodeIdRef,
    siteName,
    setSiteName,
    siteDescription,
    setSiteDescription,
    logoMode,
    setLogoMode,
    logoSvg,
    setLogoSvg,
    logoImagePath,
    setLogoImagePath,
    pwaIcon192Path,
    pwaIcon512Path,
    googleAnalyticsId,
    setGoogleAnalyticsId,
    discordLink,
    setDiscordLink,
    twitterLink,
    setTwitterLink,
    facebookLink,
    setFacebookLink,
    instagramLink,
    setInstagramLink,
    tiktokLink,
    setTiktokLink,
    linkedinLink,
    setLinkedinLink,
    youtubeLink,
    setYoutubeLink,
    supportUrl,
    setSupportUrl,
    globalAnnouncementMessage,
    setGlobalAnnouncementMessage,
    globalAnnouncementLinkUrl,
    setGlobalAnnouncementLinkUrl,
    globalAnnouncementDisabledOn,
    setGlobalAnnouncementDisabledOn,
    customJavascriptCodes,
    setCustomJavascriptCodes,
    feeRecipientWallet,
    setFeeRecipientWallet,
    tosPdfPath,
    setTosPdfPath,
    lifiIntegrator,
    setLifiIntegrator,
    lifiApiKey,
    setLifiApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    openRouterModel,
    setOpenRouterModel,
    openRouterSelectValue,
    setOpenRouterSelectValue,
    openRouterModelOptions,
    setOpenRouterModelOptions,
    openRouterModelsError,
    setOpenRouterModelsError,
    isRefreshingOpenRouterModels,
    setIsRefreshingOpenRouterModels,
    selectedLogoFile,
    setSelectedLogoFile,
    selectedTermsOfServicePdfFile,
    setSelectedTermsOfServicePdfFile,
    logoPreviewUrl,
    setLogoPreviewUrl,
    pwaIcon192PreviewUrl,
    setPwaIcon192PreviewUrl,
    pwaIcon512PreviewUrl,
    setPwaIcon512PreviewUrl,
    openSections,
    setOpenSections,
    imagePreview,
    pwaIcon192Preview,
    pwaIcon512Preview,
    serializedCustomJavascriptCodes,
    serializedGlobalAnnouncementDisabledOn,
    customJavascriptCodeDisablePageOptions,
    sanitizedLogoSvg,
    svgPreviewUrl,
    initialLogoMode,
    initialLiFiApiKeyConfigured: initialThemeSiteSettings.lifiApiKeyConfigured,
    initialOpenRouterApiKeyConfigured: openRouterSettings.isApiKeyConfigured,
  }
}

function AdminGeneralSettingsFormInner({
  initialThemeSiteSettings,
  initialGlobalAnnouncement,
  initialTermsOfServicePdfPath,
  initialTermsOfServicePdfUrl,
  openRouterSettings,
}: AdminGeneralSettingsFormProps) {
  const t = useExtracted()
  const {
    router,
    state,
    formAction,
    isPending,
    isRemovingTermsOfServicePdf,
    startRemovingTermsOfServicePdf,
    nextCustomJavascriptCodeIdRef,
    siteName,
    setSiteName,
    siteDescription,
    setSiteDescription,
    logoMode,
    setLogoMode,
    logoSvg,
    setLogoSvg,
    logoImagePath,
    setLogoImagePath,
    pwaIcon192Path,
    pwaIcon512Path,
    googleAnalyticsId,
    setGoogleAnalyticsId,
    discordLink,
    setDiscordLink,
    twitterLink,
    setTwitterLink,
    facebookLink,
    setFacebookLink,
    instagramLink,
    setInstagramLink,
    tiktokLink,
    setTiktokLink,
    linkedinLink,
    setLinkedinLink,
    youtubeLink,
    setYoutubeLink,
    supportUrl,
    setSupportUrl,
    globalAnnouncementMessage,
    setGlobalAnnouncementMessage,
    globalAnnouncementLinkUrl,
    setGlobalAnnouncementLinkUrl,
    globalAnnouncementDisabledOn,
    setGlobalAnnouncementDisabledOn,
    customJavascriptCodes,
    setCustomJavascriptCodes,
    feeRecipientWallet,
    setFeeRecipientWallet,
    tosPdfPath,
    setTosPdfPath,
    lifiIntegrator,
    setLifiIntegrator,
    lifiApiKey,
    setLifiApiKey,
    openRouterApiKey,
    setOpenRouterApiKey,
    openRouterModel,
    setOpenRouterModel,
    openRouterSelectValue,
    setOpenRouterSelectValue,
    openRouterModelOptions,
    setOpenRouterModelOptions,
    openRouterModelsError,
    setOpenRouterModelsError,
    isRefreshingOpenRouterModels,
    setIsRefreshingOpenRouterModels,
    selectedLogoFile,
    setSelectedLogoFile,
    selectedTermsOfServicePdfFile,
    setSelectedTermsOfServicePdfFile,
    logoPreviewUrl,
    setLogoPreviewUrl,
    pwaIcon192PreviewUrl,
    setPwaIcon192PreviewUrl,
    pwaIcon512PreviewUrl,
    setPwaIcon512PreviewUrl,
    openSections,
    setOpenSections,
    imagePreview,
    pwaIcon192Preview,
    pwaIcon512Preview,
    serializedCustomJavascriptCodes,
    serializedGlobalAnnouncementDisabledOn,
    customJavascriptCodeDisablePageOptions,
    sanitizedLogoSvg,
    svgPreviewUrl,
    initialLogoMode,
    initialLiFiApiKeyConfigured,
    initialOpenRouterApiKeyConfigured,
  } = useGeneralSettingsFormState({
    initialThemeSiteSettings,
    initialGlobalAnnouncement,
    initialTermsOfServicePdfPath,
    openRouterSettings,
  })

  const showImagePreview = Boolean(imagePreview)
  const showSvgPreview = !showImagePreview && Boolean(sanitizedLogoSvg.trim())
  const hasUploadedTermsOfServicePdf = Boolean(initialTermsOfServicePdfUrl && tosPdfPath.trim())
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

  function updateCustomJavascriptCode(
    index: number,
    updater: (code: CustomJavascriptCodeDraft) => CustomJavascriptCodeDraft,
  ) {
    setCustomJavascriptCodes(previous => previous.map((code, codeIndex) => (
      codeIndex === index ? updater(code) : code
    )))
  }

  function handleAddCustomJavascriptCode() {
    setCustomJavascriptCodes(previous => [
      ...previous,
      createCustomJavascriptCodeDraft(nextCustomJavascriptCodeIdRef.current++, {
        name: '',
        snippet: '',
        disabledOn: [],
      }),
    ])
  }

  function handleRemoveCustomJavascriptCode(index: number) {
    setCustomJavascriptCodes(previous => previous.filter((_, codeIndex) => codeIndex !== index))
  }

  function handleToggleCustomJavascriptCodeDisableOn(
    index: number,
    value: CustomJavascriptCodeDisablePage,
    checked: boolean,
  ) {
    updateCustomJavascriptCode(index, (code) => {
      const disabledOn = checked
        ? Array.from(new Set([...code.disabledOn, value]))
        : code.disabledOn.filter(entry => entry !== value)

      return {
        ...code,
        disabledOn,
      }
    })
  }

  function handleToggleGlobalAnnouncementDisableOn(value: CustomJavascriptCodeDisablePage, checked: boolean) {
    setGlobalAnnouncementDisabledOn((previous) => {
      const next = checked
        ? Array.from(new Set([...previous, value]))
        : previous.filter(entry => entry !== value)

      return next
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

  function handleRemoveTermsOfServicePdf() {
    startRemovingTermsOfServicePdf(async () => {
      try {
        const result = await removeTermsOfServicePdfAction()

        if (result.error) {
          toast.error(result.error)
          return
        }

        setTosPdfPath('')
        setSelectedTermsOfServicePdfFile(null)
        toast.success(t('Terms of Use PDF removed.'))
        router.refresh()
      }
      catch (error) {
        console.error('Failed to remove Terms of Use PDF', error)
        toast.error(t('Unable to remove the Terms of Use PDF right now.'))
      }
    })
  }

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />
      <input type="hidden" name="logo_svg" value={logoSvg} />
      <input type="hidden" name="pwa_icon_192_path" value={pwaIcon192Path} />
      <input type="hidden" name="pwa_icon_512_path" value={pwaIcon512Path} />
      <input type="hidden" name="openrouter_model" value={openRouterModel} />
      <input type="hidden" name="tos_pdf_path" value={tosPdfPath} />
      <input type="hidden" name="custom_javascript_codes_json" value={serializedCustomJavascriptCodes} />
      <input type="hidden" name="global_announcement_disabled_on_json" value={serializedGlobalAnnouncementDisabledOn} />

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
          header={<h3 className="text-base font-medium">{t('Social & Community')}</h3>}
        >
          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="grid gap-2">
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
          value="global-announcement"
          isOpen={openSections.includes('global-announcement')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Global announcement banner')}</h3>}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="global-announcement-message">{t('Message')}</Label>
              <Input
                id="global-announcement-message"
                name="global_announcement_message"
                maxLength={MAX_GLOBAL_ANNOUNCEMENT_MESSAGE_LENGTH}
                value={globalAnnouncementMessage}
                onChange={event => setGlobalAnnouncementMessage(event.target.value)}
                disabled={isPending}
                placeholder={t('e.g. Refer friends and earn rewards this week')}
              />
              <p className="text-xs text-muted-foreground">
                {t('Displayed in the website header. Leave empty to hide.')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="global-announcement-link-url">{t('URL (optional)')}</Label>
              <Input
                id="global-announcement-link-url"
                name="global_announcement_link_url"
                maxLength={MAX_GLOBAL_ANNOUNCEMENT_LINK_URL_LENGTH}
                value={globalAnnouncementLinkUrl}
                onChange={event => setGlobalAnnouncementLinkUrl(event.target.value)}
                disabled={isPending}
                placeholder={t('https://example.com/campaign')}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('Disable on')}</Label>
              <div className="flex flex-wrap gap-3">
                {customJavascriptCodeDisablePageOptions.map((option) => {
                  const fieldId = `global-announcement-disable-${option.value}`
                  return (
                    <label
                      key={option.value}
                      htmlFor={fieldId}
                      className={cn(
                        `
                          flex min-w-32 cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2
                          text-sm transition-colors
                          hover:bg-muted/40
                        `,
                        globalAnnouncementDisabledOn.includes(option.value) && 'border-primary/50 bg-primary/5',
                      )}
                    >
                      <Checkbox
                        id={fieldId}
                        checked={globalAnnouncementDisabledOn.includes(option.value)}
                        disabled={isPending}
                        onCheckedChange={checked => handleToggleGlobalAnnouncementDisableOn(option.value, checked === true)}
                      />
                      <span>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="legal"
          isOpen={openSections.includes('legal')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Legal')}</h3>}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="terms-of-service-pdf">{t('Terms of Use PDF')}</Label>
              <Input
                id="terms-of-service-pdf"
                type="file"
                name="tos_pdf"
                accept="application/pdf"
                disabled={isPending || isRemovingTermsOfServicePdf}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setSelectedTermsOfServicePdfFile(file)
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('Upload a PDF to replace the default /tos page content. PDF only, up to 2MB.')}
              </p>
            </div>

            {selectedTermsOfServicePdfFile
              ? (
                  <p className="text-xs text-muted-foreground">
                    {t('Selected file:')}
                    {' '}
                    {selectedTermsOfServicePdfFile.name}
                  </p>
                )
              : null}

            {hasUploadedTermsOfServicePdf
              && (
                <div className="
                  flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4
                  sm:flex-row sm:items-center sm:justify-between
                "
                >
                  <div className="grid gap-1">
                    <p className="text-sm font-medium">{t('An uploaded Terms of Use PDF is currently active on /tos.')}</p>
                    <a
                      href={initialTermsOfServicePdfUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground underline underline-offset-2"
                    >
                      {t('Open current PDF')}
                    </a>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || isRemovingTermsOfServicePdf}
                    onClick={handleRemoveTermsOfServicePdf}
                  >
                    {isRemovingTermsOfServicePdf ? t('Removing...') : t('Remove uploaded PDF')}
                  </Button>
                </div>
              )}
          </div>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          value="integrations"
          isOpen={openSections.includes('integrations')}
          onToggle={toggleSection}
          header={<h3 className="text-base font-medium">{t('Integrations')}</h3>}
        >
          <div className="grid gap-6">
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
                  onClick={handleAddCustomJavascriptCode}
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
                            onClick={() => handleRemoveCustomJavascriptCode(index)}
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
                              onChange={event => updateCustomJavascriptCode(index, current => ({
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
                              onChange={event => updateCustomJavascriptCode(index, current => ({
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
                                    onCheckedChange={checked => handleToggleCustomJavascriptCodeDisableOn(index, option.value, checked === true)}
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
        <Button type="submit" className="w-full sm:w-40" disabled={isPending || isRemovingTermsOfServicePdf}>
          {isPending ? t('Saving...') : t('Save settings')}
        </Button>
      </div>
    </form>
  )
}

export default function AdminGeneralSettingsForm(props: AdminGeneralSettingsFormProps) {
  const formResetKey = JSON.stringify({
    initialThemeSiteSettings: props.initialThemeSiteSettings,
    initialGlobalAnnouncement: props.initialGlobalAnnouncement,
    initialTermsOfServicePdfPath: props.initialTermsOfServicePdfPath,
    initialTermsOfServicePdfUrl: props.initialTermsOfServicePdfUrl,
    openRouterSettings: props.openRouterSettings,
  })

  return <AdminGeneralSettingsFormInner key={formResetKey} {...props} />
}
