'use client'

import type { IconName } from 'lucide-react/dynamic'
import type { Dispatch, SetStateAction } from 'react'
import type {
  HomeFeaturedSideCardSettings,
  HomeFeaturedSideCardSlide,
  HomeFeaturedSideCardSlideType,
} from '@/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileTextIcon,
  ImageIcon,
  Trash2Icon,
  VideoIcon,
} from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useExtracted } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  HOME_FEATURED_SIDE_CARD_ICONS,
  HOME_FEATURED_SIDE_CARD_LIMITS,
  HOME_FEATURED_SIDE_CARD_MAX_SLIDES,
} from '@/lib/home-featured-settings'
import { cn } from '@/lib/utils'
import HomeFeaturedAdminPreviewImage from './HomeFeaturedAdminPreviewImage'

interface HomeFeaturedSideCardCarouselDialogProps {
  isMobile: boolean
  open: boolean
  disabled: boolean
  sideCard: HomeFeaturedSideCardSettings
  imagePreviewUrls: Record<string, string>
  processingImageIds: string[]
  onOpenChange: (open: boolean) => void
  onSideCardChange: Dispatch<SetStateAction<HomeFeaturedSideCardSettings>>
  onImageChange: (slideId: string, file: File | null) => Promise<void>
}

function formatIconLabel(icon: string) {
  return icon.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function createSlide(type: HomeFeaturedSideCardSlideType, position: number): HomeFeaturedSideCardSlide {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${position}`
  return {
    id: `slide-${randomId}`.toLowerCase(),
    enabled: true,
    type,
    title: 'Market pulse',
    text: 'Fast movers across active markets.',
    ctaLabel: '',
    ctaHref: '',
    icon: 'trending-up',
    useAi: false,
    useImage: type === 'image',
    imagePath: '',
    imageUrl: '',
    videoUrl: '',
    videoEmbedUrl: '',
  }
}

export default function HomeFeaturedSideCardCarouselDialog({
  isMobile,
  open,
  disabled,
  sideCard,
  imagePreviewUrls,
  processingImageIds,
  onOpenChange,
  onSideCardChange,
  onImageChange,
}: HomeFeaturedSideCardCarouselDialogProps) {
  const t = useExtracted()
  const [selectedSlideId, setSelectedSlideId] = useState(sideCard.slides[0]?.id ?? '')
  const selectedIndex = Math.max(0, sideCard.slides.findIndex(slide => slide.id === selectedSlideId))
  const selectedSlide = sideCard.slides[selectedIndex]

  function replaceSlides(updater: (slides: HomeFeaturedSideCardSlide[]) => HomeFeaturedSideCardSlide[]) {
    onSideCardChange((previous) => {
      const slides = updater(previous.slides)
      return { ...(slides[0] ?? previous), slides }
    })
  }

  function updateSelectedSlide(updates: Partial<HomeFeaturedSideCardSlide>) {
    replaceSlides(slides => slides.map(slide => slide.id === selectedSlide?.id ? { ...slide, ...updates } : slide))
  }

  function addSlide(type: HomeFeaturedSideCardSlideType) {
    const slide = createSlide(type, sideCard.slides.length + 1)
    replaceSlides(slides => [...slides, slide].slice(0, HOME_FEATURED_SIDE_CARD_MAX_SLIDES))
    setSelectedSlideId(slide.id)
  }

  function moveSelectedSlide(direction: -1 | 1) {
    replaceSlides((slides) => {
      const currentIndex = slides.findIndex(slide => slide.id === selectedSlide?.id)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= slides.length) {
        return slides
      }
      const nextSlides = [...slides]
      ;[nextSlides[currentIndex], nextSlides[nextIndex]] = [nextSlides[nextIndex]!, nextSlides[currentIndex]!]
      return nextSlides
    })
  }

  function removeSelectedSlide() {
    if (!selectedSlide || sideCard.slides.length <= 1) {
      return
    }
    const nextSlide = sideCard.slides[selectedIndex + 1] ?? sideCard.slides[selectedIndex - 1]
    replaceSlides(slides => slides.filter(slide => slide.id !== selectedSlide.id))
    setSelectedSlideId(nextSlide?.id ?? '')
  }

  function getSlideSummary(slide: HomeFeaturedSideCardSlide) {
    if (slide.type === 'video') {
      return slide.videoUrl || t('Video slide')
    }
    if (slide.type === 'image') {
      return slide.ctaLabel || t('Image slide')
    }
    return slide.title || slide.text || t('Text slide')
  }

  const content = (
    <div className="grid gap-5 md:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.3fr)]">
      <div className="grid content-start gap-3">
        <div className="grid gap-2">
          {sideCard.slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setSelectedSlideId(slide.id)}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                selectedSlide?.id === slide.id ? 'border-primary/45 bg-primary/6' : 'hover:bg-secondary/60',
              )}
            >
              {slide.type === 'image'
                ? <ImageIcon className="size-4 shrink-0" />
                : slide.type === 'video'
                  ? <VideoIcon className="size-4 shrink-0" />
                  : <FileTextIcon className="size-4 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{`${t('Slide')} ${index + 1}`}</span>
                <span className="block truncate text-sm font-medium">{getSlideSummary(slide)}</span>
              </span>
              <span className={cn('size-2 rounded-full', slide.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            ['text', FileTextIcon, t('Text')],
            ['image', ImageIcon, t('Image')],
            ['video', VideoIcon, t('Video')],
          ] as const).map(([type, Icon, label]) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              className="h-auto flex-col gap-1 p-2 text-xs"
              disabled={disabled || sideCard.slides.length >= HOME_FEATURED_SIDE_CARD_MAX_SLIDES}
              onClick={() => addSlide(type)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('The carousel advances only when more than one slide is active.')}
        </p>
      </div>

      {selectedSlide && (
        <div className="grid content-start gap-5 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={selectedSlide.enabled} onCheckedChange={enabled => updateSelectedSlide({ enabled })} disabled={disabled} />
              {t('Active slide')}
            </label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" disabled={disabled || selectedIndex === 0} onClick={() => moveSelectedSlide(-1)} aria-label={t('Move up')}>
                <ArrowUpIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={disabled || selectedIndex === sideCard.slides.length - 1} onClick={() => moveSelectedSlide(1)} aria-label={t('Move down')}>
                <ArrowDownIcon className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={disabled || sideCard.slides.length <= 1} onClick={removeSelectedSlide} aria-label={t('Remove slide')}>
                <Trash2Icon className="size-4 text-destructive" />
              </Button>
            </div>
          </div>

          {selectedSlide.type === 'image' && (
            <div className="grid gap-3">
              <div className="aspect-3/2 overflow-hidden rounded-xl border bg-muted">
                {(imagePreviewUrls[selectedSlide.id] || selectedSlide.imageUrl)
                  ? (
                      <HomeFeaturedAdminPreviewImage
                        src={imagePreviewUrls[selectedSlide.id] || selectedSlide.imageUrl}
                        alt={t('Side card image')}
                        className="size-full object-cover"
                      />
                    )
                  : <div className="flex size-full items-center justify-center text-sm text-muted-foreground">{t('No image')}</div>}
              </div>
              <input
                id={`home-featured-side-card-image-${selectedSlide.id}`}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                disabled={disabled || processingImageIds.includes(selectedSlide.id)}
                onChange={event => void onImageChange(selectedSlide.id, event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={`home-featured-side-card-image-${selectedSlide.id}`}
                  className={cn(
                    `
                      inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-4 text-sm
                      font-medium
                    `,
                    (disabled || processingImageIds.includes(selectedSlide.id)) && 'pointer-events-none opacity-50',
                  )}
                >
                  {processingImageIds.includes(selectedSlide.id) ? t('Processing...') : t('Choose image')}
                </label>
                <p className="text-xs text-muted-foreground">{t('PNG or JPG up to 2MB. Recommended size: 1200 × 800 px (3:2).')}</p>
              </div>
            </div>
          )}

          {selectedSlide.type === 'video' && (
            <div className="grid gap-2">
              <Label htmlFor={`home-featured-side-video-${selectedSlide.id}`}>{t('YouTube or Vimeo URL')}</Label>
              <Input
                id={`home-featured-side-video-${selectedSlide.id}`}
                value={selectedSlide.videoUrl}
                onChange={event => updateSelectedSlide({ videoUrl: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.videoUrl) })}
                maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.videoUrl}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">{t('Paste a public video URL. It will be converted to a privacy-safe embed when saved.')}</p>
            </div>
          )}

          {selectedSlide.type === 'text' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`home-featured-side-title-${selectedSlide.id}`}>{t('Title')}</Label>
                <Input id={`home-featured-side-title-${selectedSlide.id}`} value={selectedSlide.title} onChange={event => updateSelectedSlide({ title: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.title) })} maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.title} disabled={disabled} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`home-featured-side-text-${selectedSlide.id}`}>{t('Text')}</Label>
                <Textarea
                  id={`home-featured-side-text-${selectedSlide.id}`}
                  value={selectedSlide.text}
                  onChange={event => updateSelectedSlide({ text: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.text) })}
                  maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.text}
                  disabled={disabled}
                  className="min-h-24"
                />
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <span className="grid gap-1">
                  <span className="text-sm font-medium">{t('Generate side card with AI')}</span>
                  <span className="text-sm text-muted-foreground">{t('Use topics and featured markets to fill this card automatically.')}</span>
                </span>
                <Switch checked={selectedSlide.useAi} onCheckedChange={useAi => updateSelectedSlide({ useAi })} disabled={disabled} />
              </label>
            </>
          )}

          {selectedSlide.type !== 'video' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`home-featured-side-cta-label-${selectedSlide.id}`}>{selectedSlide.type === 'image' ? t('Hover text') : t('CTA label')}</Label>
                <Input id={`home-featured-side-cta-label-${selectedSlide.id}`} value={selectedSlide.ctaLabel} onChange={event => updateSelectedSlide({ ctaLabel: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.ctaLabel) })} maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.ctaLabel} disabled={disabled} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`home-featured-side-cta-link-${selectedSlide.id}`}>{t('CTA link')}</Label>
                <Input id={`home-featured-side-cta-link-${selectedSlide.id}`} value={selectedSlide.ctaHref} onChange={event => updateSelectedSlide({ ctaHref: event.target.value.slice(0, HOME_FEATURED_SIDE_CARD_LIMITS.ctaHref) })} maxLength={HOME_FEATURED_SIDE_CARD_LIMITS.ctaHref} placeholder="/trending" disabled={disabled} />
              </div>
            </div>
          )}

          {selectedSlide.type === 'text' && (
            <div className="grid gap-2">
              <Label>{t('Icon')}</Label>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2 rounded-lg border p-2">
                {HOME_FEATURED_SIDE_CARD_ICONS.map((icon) => {
                  const selected = selectedSlide.icon === icon
                  const label = formatIconLabel(icon)
                  return (
                    <button
                      key={icon}
                      type="button"
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      disabled={disabled}
                      onClick={() => updateSelectedSlide({ icon })}
                      className={cn(
                        `
                          flex h-9 items-center justify-center rounded-md border text-muted-foreground transition-colors
                          hover:bg-secondary
                        `,
                        selected && 'border-primary/50 bg-primary/10 text-primary',
                      )}
                    >
                      <DynamicIcon name={icon as IconName} className="size-4" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t('Side card')}</DrawerTitle>
            <DrawerDescription>{t('Add text, image, or video slides. Active slides rotate automatically and pause on hover.')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">{content}</div>
          <DrawerFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('Done')}</Button></DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('Side card')}</DialogTitle>
          <DialogDescription>{t('Add text, image, or video slides. Active slides rotate automatically and pause on hover.')}</DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('Done')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
