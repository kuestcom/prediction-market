import { loadRuntimeThemeSiteName } from '@/lib/theme-settings'

interface SiteNameProps {
  fallback?: string
}

export async function SiteName({ fallback = 'the platform' }: SiteNameProps) {
  const name = (await loadRuntimeThemeSiteName())?.trim()

  return <>{name || fallback}</>
}
