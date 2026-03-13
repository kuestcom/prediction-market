import type { CSSProperties } from 'react'

export type SportsTeamTone = 'team1' | 'team2'

export function isSportsTeamTone(value: string | null | undefined): value is SportsTeamTone {
  return value === 'team1' || value === 'team2'
}

export function resolveSportsTeamFallbackClassName(tone: SportsTeamTone) {
  return tone === 'team1' ? 'bg-primary' : 'bg-primary/60'
}

export function resolveSportsTeamFallbackColor(tone: SportsTeamTone) {
  return tone === 'team1'
    ? 'var(--primary)'
    : 'color-mix(in oklch, var(--primary) 60%, transparent)'
}

export function resolveSportsTeamFallbackDepthColor(tone: SportsTeamTone) {
  return tone === 'team1'
    ? 'color-mix(in oklch, var(--primary) 80%, transparent)'
    : 'color-mix(in oklch, var(--primary) 48%, transparent)'
}

export function resolveSportsTeamFallbackForegroundColor() {
  return 'var(--primary-foreground)'
}

export function resolveSportsTeamFallbackButtonStyle(tone: SportsTeamTone): CSSProperties {
  if (tone === 'team2') {
    return {
      backgroundColor: 'var(--card)',
      color: resolveSportsTeamFallbackForegroundColor(),
    }
  }

  return {
    backgroundColor: resolveSportsTeamFallbackColor(tone),
    color: resolveSportsTeamFallbackForegroundColor(),
  }
}

export function resolveSportsTeamFallbackOverlayStyle(tone: SportsTeamTone): CSSProperties | undefined {
  if (tone !== 'team2') {
    return undefined
  }

  return {
    backgroundColor: resolveSportsTeamFallbackColor(tone),
  }
}

export function resolveSportsTeamFallbackDepthStyle(tone: SportsTeamTone): CSSProperties {
  return {
    backgroundColor: resolveSportsTeamFallbackDepthColor(tone),
  }
}
