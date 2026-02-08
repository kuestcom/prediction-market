'use client'

import type { AdminThemeSiteSettingsInitialState } from '@/app/[locale]/admin/theme/_types/theme-form-state'
import { CircleHelp, ImageUp } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateGeneralSettingsAction } from '@/app/[locale]/admin/general/_actions/update-general-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const initialState = {
  error: null,
}

interface AdminGeneralSettingsFormProps {
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
}

export default function AdminGeneralSettingsForm({
  initialThemeSiteSettings,
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

  const showImagePreview = Boolean(imagePreview)
  const showSvgPreview = !showImagePreview && Boolean(logoSvg?.trim())

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-6 rounded-lg border p-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />

      <div className="flex items-start gap-6">
        <div className="grid w-44 gap-3">
          <Label>Logo Icon</Label>
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
                      setLogoSvg(text)
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
                <span
                  className={`
                    relative z-0 flex size-full items-center justify-center text-foreground/80
                    [&_svg]:size-[70%]
                    [&_svg_*]:fill-current [&_svg_*]:stroke-current
                  `}
                  dangerouslySetInnerHTML={{ __html: logoSvg }}
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
                  pointer-events-none absolute bottom-2 left-1/2 z-10 w-[120px] -translate-x-1/2 rounded-md
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

        <div className="grid flex-1 gap-4 self-start">
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
              placeholder="https://discord.gg/your-community (optional)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-support-link">Support link</Label>
            <Input
              id="theme-support-link"
              name="support_url"
              maxLength={2048}
              value={supportUrl}
              onChange={event => setSupportUrl(event.target.value)}
              disabled={isPending}
              placeholder="help@company.com (optional)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-fee-recipient-wallet">Fee recipient wallet</Label>
            <Input
              id="theme-fee-recipient-wallet"
              name="fee_recipient_wallet"
              maxLength={42}
              value={feeRecipientWallet}
              onChange={event => setFeeRecipientWallet(event.target.value)}
              disabled={isPending}
              placeholder="0x1234..."
            />
            <p className="text-xs text-muted-foreground">
              This wallet receives platform trading fees.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="theme-market-creators">Allowed market creator wallets</Label>
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
              placeholder={'One wallet per line\n0xabc...\n0xdef...'}
            />
            <p className="text-xs text-muted-foreground">
              Add one wallet per line or separate with commas.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="w-full sm:w-40" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </div>
      </div>

      <input type="hidden" name="logo_svg" value={logoSvg} />

      {state.error && <InputError message={state.error} />}

    </form>
  )
}
