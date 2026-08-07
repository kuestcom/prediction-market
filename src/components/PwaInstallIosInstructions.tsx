'use client'

import type { PropsWithChildren } from 'react'

import { MoreHorizontalIcon, ShareIcon, SquarePlusIcon } from 'lucide-react'
import { useLocale } from 'next-intl'

import { cn } from '@/lib/utils'

interface IosInstallCopy {
  inSafari: string
  tapMenu: string
  nextTap: string
  more: string
  viewMore: string
  share: string
  addToHomeScreen: string
}

const iosInstallCopyByLocale: Record<string, IosInstallCopy> = {
  de: {
    inSafari: 'In Safari,',
    tapMenu: 'tippe auf das Menü',
    nextTap: 'Anschließend tippe auf',
    more: 'Mehr',
    viewMore: 'Mehr anzeigen',
    share: 'Teilen',
    addToHomeScreen: 'Zu Home-Bildschirm hinzufügen',
  },
  en: {
    inSafari: 'In Safari,',
    tapMenu: 'tap the',
    nextTap: 'Then tap',
    more: 'More',
    viewMore: 'View More',
    share: 'Share',
    addToHomeScreen: 'Add to Home Screen',
  },
  es: {
    inSafari: 'En Safari,',
    tapMenu: 'toca el menú',
    nextTap: 'Luego toca',
    more: 'Más',
    viewMore: 'Ver más',
    share: 'Compartir',
    addToHomeScreen: 'Añadir a pantalla de inicio',
  },
  fr: {
    inSafari: 'Dans Safari,',
    tapMenu: 'touchez le menu',
    nextTap: 'Ensuite, touchez',
    more: 'Plus',
    viewMore: 'Afficher plus',
    share: 'Partager',
    addToHomeScreen: 'Sur l’écran d’accueil',
  },
  pt: {
    inSafari: 'No Safari,',
    tapMenu: 'toque no menu',
    nextTap: 'Em seguida, toque em',
    more: 'Mais',
    viewMore: 'Ver mais',
    share: 'Compartilhar',
    addToHomeScreen: 'Adicionar à Tela de Início',
  },
  zh: {
    inSafari: '在 Safari 中，',
    tapMenu: '轻点菜单',
    nextTap: '接着轻点',
    more: '更多',
    viewMore: '查看更多',
    share: '共享',
    addToHomeScreen: '添加到主屏幕',
  },
}

function InstructionBadge({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 font-medium text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default function PwaInstallIosInstructions({ className }: { className?: string }) {
  const locale = useLocale().split('-')[0]?.toLowerCase() ?? 'en'
  const copy = iosInstallCopyByLocale[locale] ?? iosInstallCopyByLocale.en

  return (
    <span className={cn('flex flex-col gap-2 text-sm text-muted-foreground', className)}>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          1
        </span>
        <span>{copy.inSafari}</span>
        <span>{copy.tapMenu}</span>
        <InstructionBadge>
          <MoreHorizontalIcon className="size-3.5" />
          <span>{copy.more}</span>
        </InstructionBadge>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          2
        </span>
        <span>{copy.nextTap}</span>
        <InstructionBadge>
          <ShareIcon className="size-3.5" />
          <span>{copy.share}</span>
        </InstructionBadge>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          3
        </span>
        <span>{copy.nextTap}</span>
        <InstructionBadge>
          <span>{copy.viewMore}</span>
        </InstructionBadge>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          4
        </span>
        <span>{copy.nextTap}</span>
        <InstructionBadge className="gap-1.5">
          <SquarePlusIcon className="size-3.5" />
          <span>{copy.addToHomeScreen}</span>
        </InstructionBadge>
      </span>
    </span>
  )
}
