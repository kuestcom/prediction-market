'use client'

import type {
  HomeFeaturedContextMode,
  HomeFeaturedEventAdminItem,
} from '@/types'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  NewspaperIcon,
  XIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import HomeFeaturedAdminPreviewImage from './HomeFeaturedAdminPreviewImage'

export default function HomeFeaturedEventRow({
  item,
  index,
  disabled,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onManageContext,
  onContextModeChange,
  onEnabledChange,
}: {
  item: HomeFeaturedEventAdminItem
  index: number
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onManageContext: (index: number) => void
  onContextModeChange: (index: number, mode: HomeFeaturedContextMode) => void
  onEnabledChange: (index: number, enabled: boolean) => void
}) {
  const t = useExtracted()

  return (
    <div className="
      grid min-w-0 gap-3 rounded-lg border p-3
      md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:items-center
    "
    >
      <div className="size-10 overflow-hidden rounded-lg bg-muted">
        <HomeFeaturedAdminPreviewImage src={item.iconUrl} alt="" className="size-10 object-cover" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {item.targetType === 'series' ? `${t('Series')} · ${item.seriesSlug}` : item.slug}
        </p>
      </div>

      <Select
        value={item.contextMode}
        onValueChange={value => onContextModeChange(index, value as HomeFeaturedContextMode)}
        disabled={disabled}
      >
        <SelectTrigger className="hidden w-32 sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{t('Auto')}</SelectItem>
          <SelectItem value="news">{t('News')}</SelectItem>
          <SelectItem value="comments">{t('Comments')}</SelectItem>
          <SelectItem value="hidden">{t('Hidden')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center justify-between gap-3 md:block">
        <Select
          value={item.contextMode}
          onValueChange={value => onContextModeChange(index, value as HomeFeaturedContextMode)}
          disabled={disabled}
        >
          <SelectTrigger className="w-32 sm:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t('Auto')}</SelectItem>
            <SelectItem value="news">{t('News')}</SelectItem>
            <SelectItem value="comments">{t('Comments')}</SelectItem>
            <SelectItem value="hidden">{t('Hidden')}</SelectItem>
          </SelectContent>
        </Select>

        <Switch checked={item.enabled} onCheckedChange={checked => onEnabledChange(index, checked)} disabled={disabled} />
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || item.contextMode === 'hidden' || item.contextMode === 'comments'}
          onClick={() => onManageContext(index)}
          aria-label={t('Manage context')}
        >
          <NewspaperIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isFirst}
          onClick={() => onMove(index, -1)}
          aria-label={t('Move up')}
        >
          <ArrowUpIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || isLast}
          onClick={() => onMove(index, 1)}
          aria-label={t('Move down')}
        >
          <ArrowDownIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onRemove(index)}
          aria-label={t('Remove')}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
