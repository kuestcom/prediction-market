import type { CSSProperties } from 'react'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

export function isVercelAvatarUrl(url?: string | null) {
  if (!url) {
    return false
  }
  return url.includes('avatar.vercel.sh')
}

export function getAvatarSeedFromUrl(url: string) {
  try {
    const parsed = new URL(url)
    const filename = parsed.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.\w+$/, ''))
  }
  catch {
    return ''
  }
}

export function shouldUseAvatarPlaceholder(url?: string | null) {
  return !url || isVercelAvatarUrl(url)
}

export function buildAvatarBackgroundStyle(seed: string): CSSProperties {
  const baseHue = hashString(`${seed}-base`) % 360
  const spread = 30 + (hashString(`${seed}-spread`) % 30)
  const hueA = baseHue
  const hueB = (baseHue + 120 + spread) % 360
  const hueC = (baseHue + 240 - spread) % 360
  const hueD = (baseHue + 60) % 360
  const conicStart = hashString(`${seed}-conic`) % 360
  const baseColor = hsl(hueA, 80, 54)
  const linearA = hsl(hueA, 86, 56)
  const linearB = hsl(hueB, 86, 56)
  const gradientA = hsl(hueB, 88, 54)
  const gradientB = hsl(hueC, 88, 56)
  const gradientC = hsl(hueD, 82, 52)
  const gradientD = hsl((hueA + 180) % 360, 78, 50)

  return {
    backgroundColor: baseColor,
    backgroundImage: `
      conic-gradient(from ${conicStart}deg, ${linearA}, ${gradientA}, ${linearB}, ${gradientB}, ${gradientC}, ${linearA}),
      radial-gradient(at 20% 18%, rgba(255, 255, 255, 0.6) 0px, transparent 45%),
      radial-gradient(at 82% 88%, rgba(0, 0, 0, 0.35) 0px, transparent 55%),
      radial-gradient(at 16% 74%, ${gradientA} 0px, transparent 55%),
      radial-gradient(at 80% 30%, ${gradientB} 0px, transparent 55%),
      radial-gradient(at 55% 55%, ${gradientC} 0px, transparent 60%),
      radial-gradient(at 45% 20%, ${gradientD} 0px, transparent 55%)
    `,
    backgroundBlendMode: 'soft-light, screen, multiply, normal, normal, normal, normal',
    filter: 'saturate(1.2) contrast(1.08)',
    boxShadow: 'inset 0 0 14px rgba(255, 255, 255, 0.22)',
  }
}

export function getAvatarPlaceholderStyle(
  url: string | null | undefined,
  fallbackSeed: string,
): CSSProperties {
  const seed = isVercelAvatarUrl(url) ? (getAvatarSeedFromUrl(url!) || fallbackSeed) : fallbackSeed
  return buildAvatarBackgroundStyle(seed)
}
