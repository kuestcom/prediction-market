'use client'

import type { ThemeSiteLogoMode } from '@/lib/theme-site-identity'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateThemeSiteSettingsAction } from '@/app/[locale]/admin/theme/_actions/update-theme-site-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const initialState = {
  error: null,
}

interface AdminThemeSiteSettingsFormProps {
  initialSiteName: string
  initialSiteDescription: string
  initialLogoMode: ThemeSiteLogoMode
  initialLogoSvg: string
  initialLogoImagePath: string
  initialLogoImageUrl: string | null
}

const LOGO_MODE_OPTIONS: { value: ThemeSiteLogoMode, label: string, description: string }[] = [
  {
    value: 'svg',
    label: 'SVG logo',
    description: 'Best for monochrome logos that should follow theme color.',
  },
  {
    value: 'image',
    label: 'Image logo',
    description: 'Upload PNG or JPG and keep its original colors.',
  },
]

export default function AdminThemeSiteSettingsForm({
  initialSiteName,
  initialSiteDescription,
  initialLogoMode,
  initialLogoSvg,
  initialLogoImagePath,
  initialLogoImageUrl,
}: AdminThemeSiteSettingsFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(updateThemeSiteSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  const [siteName, setSiteName] = useState(initialSiteName)
  const [siteDescription, setSiteDescription] = useState(initialSiteDescription)
  const [logoMode, setLogoMode] = useState<ThemeSiteLogoMode>(initialLogoMode)
  const [logoSvg, setLogoSvg] = useState(initialLogoSvg)
  const [logoImagePath, setLogoImagePath] = useState(initialLogoImagePath)
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
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      toast.success('Site identity updated successfully!')
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

  const activeLogoMode = logoMode

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-6 rounded-lg border p-6">
      <input type="hidden" name="logo_mode" value={logoMode} />
      <input type="hidden" name="logo_image_path" value={logoImagePath} />

      <div className="grid gap-2">
        <Label htmlFor="theme-site-name">Platform name</Label>
        <Input
          id="theme-site-name"
          name="site_name"
          maxLength={80}
          value={siteName}
          onChange={event => setSiteName(event.target.value)}
          disabled={isPending}
          placeholder="Your platform name"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="theme-site-description">Platform description</Label>
        <Textarea
          id="theme-site-description"
          name="site_description"
          rows={3}
          maxLength={180}
          value={siteDescription}
          onChange={event => setSiteDescription(event.target.value)}
          disabled={isPending}
          placeholder="Short description used in metadata and wallet dialogs"
        />
      </div>

      <div className="grid gap-2">
        <Label>Logo format</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOGO_MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => setLogoMode(option.value)}
              className={cn(
                'rounded-md border p-3 text-left transition',
                activeLogoMode === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40',
                isPending ? 'cursor-not-allowed opacity-60' : '',
              )}
            >
              <p className="text-sm font-semibold text-foreground">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {activeLogoMode === 'image' && (
        <div className="grid gap-3 rounded-md border border-border p-3">
          <div className="grid gap-1">
            <p className="text-sm font-semibold">Logo image</p>
            <p className="text-xs text-muted-foreground">Upload a PNG or JPG file up to 2MB.</p>
          </div>

          {imagePreview && (
            <div className="relative size-20 overflow-hidden rounded-md border border-border bg-background">
              <Image
                src={imagePreview}
                alt="Platform logo"
                fill
                sizes="80px"
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          <Input
            type="file"
            name="logo_image"
            accept="image/png,image/jpeg"
            disabled={isPending}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (logoPreviewUrl) {
                URL.revokeObjectURL(logoPreviewUrl)
              }

              setSelectedLogoFile(file)

              if (file) {
                setLogoPreviewUrl(URL.createObjectURL(file))
              }
              else {
                setLogoPreviewUrl(null)
              }
            }}
          />

          {selectedLogoFile && (
            <p className="text-xs text-muted-foreground">
              Selected file:
              {' '}
              {selectedLogoFile.name}
            </p>
          )}
        </div>
      )}

      {activeLogoMode === 'svg' && (
        <div className="grid gap-2">
          <Label htmlFor="theme-logo-svg">Logo SVG code</Label>
          <Textarea
            id="theme-logo-svg"
            name="logo_svg"
            rows={8}
            value={logoSvg}
            onChange={event => setLogoSvg(event.target.value)}
            disabled={isPending}
            className="font-mono text-xs"
          />
        </div>
      )}

      {activeLogoMode === 'image' && (
        <input type="hidden" name="logo_svg" value={logoSvg} />
      )}

      {state.error && <InputError message={state.error} />}

      <Button type="submit" className="w-full sm:w-40" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save identity'}
      </Button>
    </form>
  )
}
