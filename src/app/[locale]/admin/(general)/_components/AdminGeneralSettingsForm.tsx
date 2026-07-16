'use client'

import type { GeneralSettingsActionState } from '@/app/[locale]/admin/(general)/_actions/update-general-settings'
import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import type { MarketContextVariable } from '@/lib/ai/market-context-template'
import type { CustomJavascriptCodeConfig, CustomJavascriptCodeDisablePage } from '@/lib/custom-javascript-code'
import type { HomeFeaturedEventAdminItem, HomeFeaturedSettings } from '@/types'
import { useExtracted } from 'next-intl'
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  removeTermsOfServicePdfAction,
  updateGeneralSettingsAction,
} from '@/app/[locale]/admin/(general)/_actions/update-general-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { serializeCustomJavascriptCodes } from '@/lib/custom-javascript-code'
import { serializeHomeFeaturedEventsForSave } from '@/lib/home-featured-payload'
import { DEFAULT_HOME_FEATURED_SETTINGS } from '@/lib/home-featured-settings'
import { optimizeSideCardImage } from '@/lib/side-card-image-client'
import { sanitizeSvg } from '@/lib/utils'
import BrandIdentitySection from './BrandIdentitySection'
import GlobalAnnouncementSection from './GlobalAnnouncementSection'
import HomeFeaturedMarketsSection from './HomeFeaturedMarketsSection'
import IntegrationsSection from './IntegrationsSection'
import LegalSection from './LegalSection'
import MarketContextSection from './MarketContextSection'
import MarketFeeSection from './MarketFeeSection'
import SocialCommunitySection from './SocialCommunitySection'

const initialState: GeneralSettingsActionState = {
  error: null,
}

const AUTOMATIC_MODEL_VALUE = '__AUTOMATIC__'

function formatBlockedCountriesValue(countries: string[]) {
  return countries.join(', ')
}

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

interface SportsSourceGeneralSettings {
  isPandaScoreTokenConfigured: boolean
  isTheSportsDbApiKeyConfigured: boolean
}

interface InitialGlobalAnnouncementSettings {
  message: string
  linkUrl: string
  disabledOn: CustomJavascriptCodeDisablePage[]
  disableFaucetBanner: boolean
}

interface InitialMarketContextSettings {
  enabled: boolean
  prompt: string
}

interface AdminGeneralSettingsFormProps {
  locale: string
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
  initialGlobalAnnouncement: InitialGlobalAnnouncementSettings
  initialBlockedCountries: string[]
  initialTermsOfServicePdfPath: string
  initialTermsOfServicePdfUrl: string | null
  initialMarketContextSettings: InitialMarketContextSettings
  initialArbitrageEnabled: boolean
  initialArbitrageMultiWalletEnabled: boolean
  marketContextVariables: MarketContextVariable[]
  initialHomeFeaturedSettings?: HomeFeaturedSettings
  initialHomeFeaturedSideCardImageUrl?: string | null
  initialHomeFeaturedEvents?: HomeFeaturedEventAdminItem[]
  openRouterSettings: OpenRouterGeneralSettings
  sportsSourceSettings: SportsSourceGeneralSettings
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

function AdminGeneralSettingsFormInner({
  locale,
  initialThemeSiteSettings,
  initialGlobalAnnouncement,
  initialBlockedCountries,
  initialTermsOfServicePdfPath,
  initialTermsOfServicePdfUrl,
  initialMarketContextSettings,
  initialArbitrageEnabled,
  initialArbitrageMultiWalletEnabled,
  marketContextVariables,
  initialHomeFeaturedSettings,
  initialHomeFeaturedSideCardImageUrl,
  initialHomeFeaturedEvents,
  openRouterSettings,
  sportsSourceSettings,
}: AdminGeneralSettingsFormProps) {
  const t = useExtracted()
  const settingsSavedMessage = t('Settings saved successfully!')
  const resolvedInitialHomeFeaturedSettings = initialHomeFeaturedSettings ?? DEFAULT_HOME_FEATURED_SETTINGS
  const resolvedInitialHomeFeaturedEvents = initialHomeFeaturedEvents ?? []
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
  const initialGlobalAnnouncementMessage = initialGlobalAnnouncement.message
  const initialGlobalAnnouncementLinkUrl = initialGlobalAnnouncement.linkUrl
  const initialGlobalAnnouncementDisabledOn = initialGlobalAnnouncement.disabledOn
  const initialGlobalAnnouncementDisableFaucetBanner = initialGlobalAnnouncement.disableFaucetBanner
  const initialCustomJavascriptCodes = initialThemeSiteSettings.customJavascriptCodes
  const initialLiFiIntegrator = initialThemeSiteSettings.lifiIntegrator
  const initialLiFiApiKey = initialThemeSiteSettings.lifiApiKey
  const initialLiFiApiKeyConfigured = initialThemeSiteSettings.lifiApiKeyConfigured
  const initialOpenRouterModel = openRouterSettings.defaultModel ?? ''
  const initialOpenRouterApiKeyConfigured = openRouterSettings.isApiKeyConfigured
  const initialPandaScoreTokenConfigured = sportsSourceSettings.isPandaScoreTokenConfigured
  const initialTheSportsDbApiKeyConfigured = sportsSourceSettings.isTheSportsDbApiKeyConfigured
  const initialMarketContextEnabled = initialMarketContextSettings.enabled
  const initialMarketContextPrompt = initialMarketContextSettings.prompt
  const initialHomeFeaturedEnabled = resolvedInitialHomeFeaturedSettings.enabled
  const initialHomeFeaturedUseAi = resolvedInitialHomeFeaturedSettings.useAi
  const initialHomeFeaturedMaxCards = resolvedInitialHomeFeaturedSettings.maxCards
  const initialHomeFeaturedDefaultContextMode = resolvedInitialHomeFeaturedSettings.defaultContextMode
  const initialHomeFeaturedNewsSources = resolvedInitialHomeFeaturedSettings.newsSources
  const initialHomeFeaturedCommentBlacklist = resolvedInitialHomeFeaturedSettings.commentBlacklist
  const initialHomeFeaturedMinVolume24h = resolvedInitialHomeFeaturedSettings.minVolume24h
  const initialHomeFeaturedIncludeSportsToday = resolvedInitialHomeFeaturedSettings.includeSportsToday
  const initialHomeFeaturedIncludeNewEvents = resolvedInitialHomeFeaturedSettings.includeNewEvents
  const initialHomeFeaturedSideCard = resolvedInitialHomeFeaturedSettings.sideCard

  const optimizedSideCardImageRef = useRef<File | null>(null)
  const sideCardImageInputRef = useRef<HTMLInputElement>(null)
  const sideCardImageProcessingRequestRef = useRef(0)
  const submitGeneralSettingsAction = useCallback(
    async (previousState: GeneralSettingsActionState, formData: FormData) => {
      formData.delete('home_featured_side_card_image')
      if (formData.get('home_featured_side_card_use_image') === 'true' && optimizedSideCardImageRef.current) {
        formData.set('home_featured_side_card_image', optimizedSideCardImageRef.current)
      }

      const result = await updateGeneralSettingsAction(previousState, formData)

      if (result.error) {
        toast.error(result.error)
      }
      else {
        optimizedSideCardImageRef.current = null
        if (sideCardImageInputRef.current) {
          sideCardImageInputRef.current.value = ''
        }
        toast.success(settingsSavedMessage)
      }

      return result
    },
    [settingsSavedMessage],
  )
  const [state, formAction, isPending] = useActionState(submitGeneralSettingsAction, initialState)
  const [isRemovingTermsOfServicePdf, startRemovingTermsOfServicePdf] = useTransition()
  const nextCustomJavascriptCodeIdRef = useRef(0)

  const [siteName, setSiteName] = useState(initialSiteName)
  const [siteDescription, setSiteDescription] = useState(initialSiteDescription)
  const [logoMode, setLogoMode] = useState(initialLogoMode)
  const [logoSvg, setLogoSvg] = useState(initialLogoSvg)
  const [logoImagePath, setLogoImagePath] = useState(initialLogoImagePath)
  const [pwaIcon192Path] = useState(initialPwaIcon192Path)
  const [pwaIcon512Path] = useState(initialPwaIcon512Path)
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(initialGoogleAnalyticsId)
  const [discordLink, setDiscordLink] = useState(initialDiscordLink)
  const [twitterLink, setTwitterLink] = useState(initialTwitterLink)
  const [facebookLink, setFacebookLink] = useState(initialFacebookLink)
  const [instagramLink, setInstagramLink] = useState(initialInstagramLink)
  const [tiktokLink, setTiktokLink] = useState(initialTiktokLink)
  const [linkedinLink, setLinkedinLink] = useState(initialLinkedinLink)
  const [youtubeLink, setYoutubeLink] = useState(initialYoutubeLink)
  const [supportUrl, setSupportUrl] = useState(initialSupportUrl)
  const [blockedCountries, setBlockedCountries] = useState(initialBlockedCountries)
  const [globalAnnouncementMessage, setGlobalAnnouncementMessage] = useState(initialGlobalAnnouncementMessage)
  const [globalAnnouncementLinkUrl, setGlobalAnnouncementLinkUrl] = useState(initialGlobalAnnouncementLinkUrl)
  const [globalAnnouncementDisabledOn, setGlobalAnnouncementDisabledOn] = useState<CustomJavascriptCodeDisablePage[]>(
    initialGlobalAnnouncementDisabledOn,
  )
  const [globalAnnouncementDisableFaucetBanner, setGlobalAnnouncementDisableFaucetBanner] = useState(
    initialGlobalAnnouncementDisableFaucetBanner,
  )
  const [customJavascriptCodes, setCustomJavascriptCodes] = useState<CustomJavascriptCodeDraft[]>(
    () => initialCustomJavascriptCodes.map(code => createCustomJavascriptCodeDraft(nextCustomJavascriptCodeIdRef.current++, code)),
  )
  const [tosPdfPath, setTosPdfPath] = useState(initialTermsOfServicePdfPath)
  const [lifiIntegrator, setLifiIntegrator] = useState(initialLiFiIntegrator)
  const [lifiApiKey, setLifiApiKey] = useState(initialLiFiApiKey)
  const [arbitrageEnabled, setArbitrageEnabled] = useState(initialArbitrageEnabled)
  const [arbitrageMultiWalletEnabled, setArbitrageMultiWalletEnabled] = useState(
    initialArbitrageMultiWalletEnabled,
  )
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [pandaScoreToken, setPandaScoreToken] = useState('')
  const [theSportsDbApiKey, setTheSportsDbApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState(initialOpenRouterModel)
  const [openRouterSelectValue, setOpenRouterSelectValue] = useState(
    initialOpenRouterModel || AUTOMATIC_MODEL_VALUE,
  )
  const [openRouterModelOptions, setOpenRouterModelOptions] = useState<ModelOption[]>(openRouterSettings.modelOptions)
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | undefined>(openRouterSettings.modelsError)
  const [isRefreshingOpenRouterModels, setIsRefreshingOpenRouterModels] = useState(false)
  const [marketContextEnabled, setMarketContextEnabled] = useState(initialMarketContextEnabled)
  const [marketContextPrompt, setMarketContextPrompt] = useState(initialMarketContextPrompt)
  const [homeFeaturedEnabled, setHomeFeaturedEnabled] = useState(initialHomeFeaturedEnabled)
  const [homeFeaturedUseAi, setHomeFeaturedUseAi] = useState(initialHomeFeaturedUseAi)
  const [homeFeaturedMaxCards, setHomeFeaturedMaxCards] = useState(initialHomeFeaturedMaxCards)
  const [homeFeaturedDefaultContextMode, setHomeFeaturedDefaultContextMode] = useState(initialHomeFeaturedDefaultContextMode)
  const [homeFeaturedNewsSources, setHomeFeaturedNewsSources] = useState(initialHomeFeaturedNewsSources.join('\n'))
  const [homeFeaturedCommentBlacklist, setHomeFeaturedCommentBlacklist] = useState(initialHomeFeaturedCommentBlacklist.join('\n'))
  const [homeFeaturedMinVolume24h, setHomeFeaturedMinVolume24h] = useState(initialHomeFeaturedMinVolume24h)
  const [homeFeaturedIncludeSportsToday, setHomeFeaturedIncludeSportsToday] = useState(initialHomeFeaturedIncludeSportsToday)
  const [homeFeaturedIncludeNewEvents, setHomeFeaturedIncludeNewEvents] = useState(initialHomeFeaturedIncludeNewEvents)
  const [homeFeaturedSideCard, setHomeFeaturedSideCard] = useState(initialHomeFeaturedSideCard)
  const [homeFeaturedEvents, setHomeFeaturedEvents] = useState<HomeFeaturedEventAdminItem[]>(resolvedInitialHomeFeaturedEvents)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [selectedTermsOfServicePdfFile, setSelectedTermsOfServicePdfFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [pwaIcon192PreviewUrl, setPwaIcon192PreviewUrl] = useState<string | null>(null)
  const [pwaIcon512PreviewUrl, setPwaIcon512PreviewUrl] = useState<string | null>(null)
  const [sideCardImagePreviewUrl, setSideCardImagePreviewUrl] = useState<string | null>(null)
  const [isSideCardImageProcessing, setIsSideCardImageProcessing] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>([])

  useEffect(function cancelPendingSideCardImageProcessing() {
    return function cleanup() {
      sideCardImageProcessingRequestRef.current += 1
    }
  }, [])

  useEffect(function revokeObjectUrls() {
    return function cleanup() {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
      if (pwaIcon192PreviewUrl) {
        URL.revokeObjectURL(pwaIcon192PreviewUrl)
      }
      if (pwaIcon512PreviewUrl) {
        URL.revokeObjectURL(pwaIcon512PreviewUrl)
      }
      if (sideCardImagePreviewUrl) {
        URL.revokeObjectURL(sideCardImagePreviewUrl)
      }
    }
  }, [logoPreviewUrl, pwaIcon192PreviewUrl, pwaIcon512PreviewUrl, sideCardImagePreviewUrl])

  const imagePreview = useMemo(() => logoPreviewUrl ?? initialLogoImageUrl, [initialLogoImageUrl, logoPreviewUrl])
  const pwaIcon192Preview = useMemo(() => pwaIcon192PreviewUrl ?? initialPwaIcon192Url, [initialPwaIcon192Url, pwaIcon192PreviewUrl])
  const pwaIcon512Preview = useMemo(() => pwaIcon512PreviewUrl ?? initialPwaIcon512Url, [initialPwaIcon512Url, pwaIcon512PreviewUrl])
  const sideCardImagePreview = useMemo(
    () => sideCardImagePreviewUrl ?? initialHomeFeaturedSideCardImageUrl ?? null,
    [initialHomeFeaturedSideCardImageUrl, sideCardImagePreviewUrl],
  )
  const serializedCustomJavascriptCodes = useMemo(
    () => serializeCustomJavascriptCodes(customJavascriptCodes.map(toCustomJavascriptCodeConfig)),
    [customJavascriptCodes],
  )
  const serializedGlobalAnnouncementDisabledOn = useMemo(
    () => JSON.stringify(globalAnnouncementDisabledOn),
    [globalAnnouncementDisabledOn],
  )
  const blockedCountriesValue = useMemo(() => formatBlockedCountriesValue(blockedCountries), [blockedCountries])
  const serializedHomeFeaturedEvents = useMemo(
    () => JSON.stringify(serializeHomeFeaturedEventsForSave(homeFeaturedEvents, locale)),
    [homeFeaturedEvents, locale],
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

  const hasUploadedTermsOfServicePdf = Boolean(initialTermsOfServicePdfUrl && tosPdfPath.trim())
  const trimmedOpenRouterApiKey = openRouterApiKey.trim()
  const openRouterModelSelectEnabled = openRouterSettings.isModelSelectEnabled || Boolean(trimmedOpenRouterApiKey)

  function handleOpenRouterModelChange(nextValue: string) {
    setOpenRouterSelectValue(nextValue)
    setOpenRouterModel(nextValue === AUTOMATIC_MODEL_VALUE ? '' : nextValue)
  }

  function handleToggleBlockedCountry(code: string, checked: boolean) {
    setBlockedCountries((previous) => {
      if (checked) {
        if (previous.includes(code)) {
          return previous
        }

        return [...previous, code]
      }

      return previous.filter(countryCode => countryCode !== code)
    })
  }

  function handleClearBlockedCountries() {
    setBlockedCountries([])
  }

  async function handleSideCardImageChange(file: File | null) {
    const requestId = ++sideCardImageProcessingRequestRef.current
    optimizedSideCardImageRef.current = null

    if (sideCardImagePreviewUrl) {
      URL.revokeObjectURL(sideCardImagePreviewUrl)
    }
    setSideCardImagePreviewUrl(null)

    if (!file) {
      setIsSideCardImageProcessing(false)
      return
    }

    setIsSideCardImageProcessing(true)
    try {
      const optimizedFile = await optimizeSideCardImage(file)
      if (requestId !== sideCardImageProcessingRequestRef.current) {
        return
      }

      const previewUrl = URL.createObjectURL(optimizedFile)
      optimizedSideCardImageRef.current = optimizedFile
      setSideCardImagePreviewUrl(previewUrl)
    }
    catch (error) {
      if (requestId !== sideCardImageProcessingRequestRef.current) {
        return
      }

      console.error('Failed to optimize side card image', error)
      optimizedSideCardImageRef.current = null
      if (sideCardImageInputRef.current) {
        sideCardImageInputRef.current.value = ''
      }
      toast.error(t('Could not process the side card image. Please try another image.'))
    }
    finally {
      if (requestId === sideCardImageProcessingRequestRef.current) {
        setIsSideCardImageProcessing(false)
      }
    }
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
      }
      catch (error) {
        console.error('Failed to remove Terms of Use PDF', error)
        toast.error(t('Unable to remove the Terms of Use PDF right now.'))
      }
    })
  }

  return (
    <form action={formAction} className="grid max-w-full min-w-0 gap-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />
      <input type="hidden" name="logo_svg" value={logoSvg} />
      <input type="hidden" name="pwa_icon_192_path" value={pwaIcon192Path} />
      <input type="hidden" name="pwa_icon_512_path" value={pwaIcon512Path} />
      <input type="hidden" name="openrouter_model" value={openRouterModel} />
      <input type="hidden" name="market_context_enabled" value={String(marketContextEnabled)} />
      <input type="hidden" name="market_context_prompt" value={marketContextPrompt} />
      <input type="hidden" name="tos_pdf_path" value={tosPdfPath} />
      <input type="hidden" name="custom_javascript_codes_json" value={serializedCustomJavascriptCodes} />
      <input type="hidden" name="global_announcement_disabled_on_json" value={serializedGlobalAnnouncementDisabledOn} />
      <input
        type="hidden"
        name="global_announcement_disable_faucet_banner"
        value={String(globalAnnouncementDisableFaucetBanner)}
      />
      <input type="hidden" name="blocked_countries" value={blockedCountriesValue} />
      <input type="hidden" name="home_featured_enabled" value={String(homeFeaturedEnabled)} />
      <input type="hidden" name="home_featured_use_ai" value={String(homeFeaturedUseAi)} />
      <input type="hidden" name="home_featured_max_cards" value={String(homeFeaturedMaxCards)} />
      <input type="hidden" name="home_featured_default_context_mode" value={homeFeaturedDefaultContextMode} />
      <input type="hidden" name="home_featured_news_sources" value={homeFeaturedNewsSources} />
      <input type="hidden" name="home_featured_comment_blacklist" value={homeFeaturedCommentBlacklist} />
      <input type="hidden" name="home_featured_min_volume_24h" value={String(homeFeaturedMinVolume24h)} />
      <input type="hidden" name="home_featured_include_sports_today" value={String(homeFeaturedIncludeSportsToday)} />
      <input type="hidden" name="home_featured_include_new_events" value={String(homeFeaturedIncludeNewEvents)} />
      <input type="hidden" name="home_featured_side_card_title" value={homeFeaturedSideCard.title} />
      <input type="hidden" name="home_featured_side_card_text" value={homeFeaturedSideCard.text} />
      <input type="hidden" name="home_featured_side_card_cta_label" value={homeFeaturedSideCard.ctaLabel} />
      <input type="hidden" name="home_featured_side_card_cta_href" value={homeFeaturedSideCard.ctaHref} />
      <input type="hidden" name="home_featured_side_card_icon" value={homeFeaturedSideCard.icon} />
      <input type="hidden" name="home_featured_side_card_use_ai" value={String(homeFeaturedSideCard.useAi)} />
      <input type="hidden" name="home_featured_side_card_use_image" value={String(homeFeaturedSideCard.useImage)} />
      <input type="hidden" name="home_featured_side_card_image_path" value={homeFeaturedSideCard.imagePath} />
      <input
        ref={sideCardImageInputRef}
        id="home-featured-side-card-image-file"
        type="file"
        name="home_featured_side_card_image"
        accept="image/png,image/jpeg"
        disabled={isPending || isSideCardImageProcessing}
        className="sr-only"
        onChange={event => void handleSideCardImageChange(event.target.files?.[0] ?? null)}
      />
      <input type="hidden" name="home_featured_events_json" value={serializedHomeFeaturedEvents} />

      <div className="grid min-w-0 gap-6">
        <BrandIdentitySection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
          siteName={siteName}
          setSiteName={setSiteName}
          siteDescription={siteDescription}
          setSiteDescription={setSiteDescription}
          logoMode={logoMode}
          setLogoMode={setLogoMode}
          logoSvg={logoSvg}
          setLogoSvg={setLogoSvg}
          logoImagePath={logoImagePath}
          setLogoImagePath={setLogoImagePath}
          selectedLogoFile={selectedLogoFile}
          setSelectedLogoFile={setSelectedLogoFile}
          logoPreviewUrl={logoPreviewUrl}
          setLogoPreviewUrl={setLogoPreviewUrl}
          pwaIcon192PreviewUrl={pwaIcon192PreviewUrl}
          setPwaIcon192PreviewUrl={setPwaIcon192PreviewUrl}
          pwaIcon512PreviewUrl={pwaIcon512PreviewUrl}
          setPwaIcon512PreviewUrl={setPwaIcon512PreviewUrl}
          imagePreview={imagePreview}
          svgPreviewUrl={svgPreviewUrl}
          sanitizedLogoSvg={sanitizedLogoSvg}
          pwaIcon192Preview={pwaIcon192Preview}
          pwaIcon512Preview={pwaIcon512Preview}
          initialLogoMode={initialLogoMode}
        />

        <SocialCommunitySection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
          discordLink={discordLink}
          setDiscordLink={setDiscordLink}
          twitterLink={twitterLink}
          setTwitterLink={setTwitterLink}
          facebookLink={facebookLink}
          setFacebookLink={setFacebookLink}
          instagramLink={instagramLink}
          setInstagramLink={setInstagramLink}
          tiktokLink={tiktokLink}
          setTiktokLink={setTiktokLink}
          linkedinLink={linkedinLink}
          setLinkedinLink={setLinkedinLink}
          youtubeLink={youtubeLink}
          setYoutubeLink={setYoutubeLink}
          supportUrl={supportUrl}
          setSupportUrl={setSupportUrl}
        />

        <GlobalAnnouncementSection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
          globalAnnouncementMessage={globalAnnouncementMessage}
          onGlobalAnnouncementMessageChange={setGlobalAnnouncementMessage}
          globalAnnouncementLinkUrl={globalAnnouncementLinkUrl}
          onGlobalAnnouncementLinkUrlChange={setGlobalAnnouncementLinkUrl}
          globalAnnouncementDisabledOn={globalAnnouncementDisabledOn}
          onToggleGlobalAnnouncementDisableOn={handleToggleGlobalAnnouncementDisableOn}
          globalAnnouncementDisableFaucetBanner={globalAnnouncementDisableFaucetBanner}
          onGlobalAnnouncementDisableFaucetBannerChange={setGlobalAnnouncementDisableFaucetBanner}
          customJavascriptCodeDisablePageOptions={customJavascriptCodeDisablePageOptions}
        />

        <MarketContextSection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
          enabled={marketContextEnabled}
          onEnabledChange={setMarketContextEnabled}
          prompt={marketContextPrompt}
          onPromptChange={setMarketContextPrompt}
          variables={marketContextVariables}
        />

        <HomeFeaturedMarketsSection
          locale={locale}
          isPending={isPending || isSideCardImageProcessing}
          openSections={openSections}
          onToggleSection={toggleSection}
          enabled={homeFeaturedEnabled}
          onEnabledChange={setHomeFeaturedEnabled}
          useAi={homeFeaturedUseAi}
          onUseAiChange={setHomeFeaturedUseAi}
          maxCards={homeFeaturedMaxCards}
          onMaxCardsChange={setHomeFeaturedMaxCards}
          defaultContextMode={homeFeaturedDefaultContextMode}
          onDefaultContextModeChange={setHomeFeaturedDefaultContextMode}
          newsSources={homeFeaturedNewsSources}
          onNewsSourcesChange={setHomeFeaturedNewsSources}
          commentBlacklist={homeFeaturedCommentBlacklist}
          onCommentBlacklistChange={setHomeFeaturedCommentBlacklist}
          minVolume24h={homeFeaturedMinVolume24h}
          onMinVolume24hChange={setHomeFeaturedMinVolume24h}
          includeSportsToday={homeFeaturedIncludeSportsToday}
          onIncludeSportsTodayChange={setHomeFeaturedIncludeSportsToday}
          includeNewEvents={homeFeaturedIncludeNewEvents}
          onIncludeNewEventsChange={setHomeFeaturedIncludeNewEvents}
          sideCard={homeFeaturedSideCard}
          onSideCardChange={setHomeFeaturedSideCard}
          sideCardImagePreviewUrl={sideCardImagePreview}
          featuredEvents={homeFeaturedEvents}
          onFeaturedEventsChange={setHomeFeaturedEvents}
        />

        <LegalSection
          isPending={isPending}
          isRemovingTermsOfServicePdf={isRemovingTermsOfServicePdf}
          openSections={openSections}
          onToggleSection={toggleSection}
          selectedTermsOfServicePdfFile={selectedTermsOfServicePdfFile}
          setSelectedTermsOfServicePdfFile={setSelectedTermsOfServicePdfFile}
          hasUploadedTermsOfServicePdf={hasUploadedTermsOfServicePdf}
          initialTermsOfServicePdfUrl={initialTermsOfServicePdfUrl}
          onRemoveTermsOfServicePdf={handleRemoveTermsOfServicePdf}
          blockedCountries={blockedCountries}
          onToggleBlockedCountry={handleToggleBlockedCountry}
          onClearBlockedCountries={handleClearBlockedCountries}
        />

        <IntegrationsSection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
          googleAnalyticsId={googleAnalyticsId}
          onGoogleAnalyticsIdChange={setGoogleAnalyticsId}
          openRouterApiKey={openRouterApiKey}
          onOpenRouterApiKeyChange={setOpenRouterApiKey}
          openRouterSelectValue={openRouterSelectValue}
          onOpenRouterModelChange={handleOpenRouterModelChange}
          openRouterModelSelectEnabled={openRouterModelSelectEnabled}
          openRouterModelOptions={openRouterModelOptions}
          openRouterModelsError={openRouterModelsError}
          isRefreshingOpenRouterModels={isRefreshingOpenRouterModels}
          trimmedOpenRouterApiKey={trimmedOpenRouterApiKey}
          onRefreshOpenRouterModels={handleRefreshOpenRouterModels}
          initialOpenRouterApiKeyConfigured={initialOpenRouterApiKeyConfigured}
          pandaScoreToken={pandaScoreToken}
          onPandaScoreTokenChange={setPandaScoreToken}
          initialPandaScoreTokenConfigured={initialPandaScoreTokenConfigured}
          theSportsDbApiKey={theSportsDbApiKey}
          onTheSportsDbApiKeyChange={setTheSportsDbApiKey}
          initialTheSportsDbApiKeyConfigured={initialTheSportsDbApiKeyConfigured}
          lifiIntegrator={lifiIntegrator}
          onLifiIntegratorChange={setLifiIntegrator}
          lifiApiKey={lifiApiKey}
          onLifiApiKeyChange={setLifiApiKey}
          initialLiFiApiKeyConfigured={initialLiFiApiKeyConfigured}
          arbitrageEnabled={arbitrageEnabled}
          onArbitrageEnabledChange={setArbitrageEnabled}
          arbitrageMultiWalletEnabled={arbitrageMultiWalletEnabled}
          onArbitrageMultiWalletEnabledChange={setArbitrageMultiWalletEnabled}
          customJavascriptCodes={customJavascriptCodes}
          onAddCustomJavascriptCode={handleAddCustomJavascriptCode}
          onRemoveCustomJavascriptCode={handleRemoveCustomJavascriptCode}
          onUpdateCustomJavascriptCode={updateCustomJavascriptCode}
          onToggleCustomJavascriptCodeDisableOn={handleToggleCustomJavascriptCodeDisableOn}
          customJavascriptCodeDisablePageOptions={customJavascriptCodeDisablePageOptions}
        />

        <MarketFeeSection
          isPending={isPending}
          openSections={openSections}
          onToggleSection={toggleSection}
        />
      </div>

      {state.error && <InputError message={state.error} />}

      <div className="flex justify-end">
        <Button
          type="submit"
          className="w-full sm:w-40"
          disabled={isPending || isRemovingTermsOfServicePdf || isSideCardImageProcessing}
        >
          {isPending ? t('Saving...') : t('Save settings')}
        </Button>
      </div>
    </form>
  )
}

export default function AdminGeneralSettingsForm(props: AdminGeneralSettingsFormProps) {
  const formResetKey = JSON.stringify({
    initialThemeSiteSettings: props.initialThemeSiteSettings,
    locale: props.locale,
    initialGlobalAnnouncement: props.initialGlobalAnnouncement,
    initialBlockedCountries: props.initialBlockedCountries,
    initialTermsOfServicePdfPath: props.initialTermsOfServicePdfPath,
    initialTermsOfServicePdfUrl: props.initialTermsOfServicePdfUrl,
    initialMarketContextSettings: props.initialMarketContextSettings,
    initialArbitrageEnabled: props.initialArbitrageEnabled,
    initialArbitrageMultiWalletEnabled: props.initialArbitrageMultiWalletEnabled,
    marketContextVariables: props.marketContextVariables,
    initialHomeFeaturedSettings: props.initialHomeFeaturedSettings ?? DEFAULT_HOME_FEATURED_SETTINGS,
    initialHomeFeaturedSideCardImageUrl: props.initialHomeFeaturedSideCardImageUrl,
    initialHomeFeaturedEvents: props.initialHomeFeaturedEvents ?? [],
    openRouterSettings: props.openRouterSettings,
    sportsSourceSettings: props.sportsSourceSettings,
  })

  return <AdminGeneralSettingsFormInner key={formResetKey} {...props} />
}
