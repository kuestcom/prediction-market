import type { ReactNode } from 'react'
import { cache } from 'react'
import { Button } from '@/components/ui/button'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const loadSiteDiscordLink = cache(async () => {
  const runtimeTheme = await loadRuntimeThemeState()
  const value = runtimeTheme.site.discordLink?.trim()
  return value && value.length > 0 ? value : null
})

interface DiscordLinkProps {
  children?: ReactNode
  className?: string
}

export async function DiscordLink({ children = 'Discord', className }: DiscordLinkProps) {
  const discordLink = await loadSiteDiscordLink()

  if (!discordLink) {
    return null
  }

  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <a href={discordLink} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    </Button>
  )
}
