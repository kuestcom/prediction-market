import type { CSSProperties } from 'react'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface AvatarColor { h: number, s: number, l: number }
type AvatarPalette = readonly AvatarColor[]

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function hsla(hue: number, saturation: number, lightness: number, alpha: number) {
  return `hsl(${hue} ${saturation}% ${lightness}% / ${alpha})`
}

const AVATAR_PALETTES: readonly AvatarPalette[] = [
  [
    { h: 334, s: 82, l: 58 },
    { h: 270, s: 76, l: 56 },
    { h: 198, s: 84, l: 52 },
    { h: 122, s: 72, l: 50 },
  ],
  [
    { h: 12, s: 86, l: 56 },
    { h: 36, s: 92, l: 54 },
    { h: 200, s: 78, l: 48 },
    { h: 268, s: 76, l: 56 },
  ],
  [
    { h: 170, s: 80, l: 48 },
    { h: 196, s: 86, l: 54 },
    { h: 220, s: 86, l: 56 },
    { h: 292, s: 74, l: 56 },
  ],
  [
    { h: 44, s: 90, l: 58 },
    { h: 120, s: 70, l: 45 },
    { h: 200, s: 82, l: 52 },
    { h: 320, s: 70, l: 56 },
  ],
  [
    { h: 188, s: 78, l: 50 },
    { h: 152, s: 72, l: 46 },
    { h: 312, s: 70, l: 56 },
    { h: 24, s: 88, l: 56 },
  ],
  [
    { h: 210, s: 80, l: 52 },
    { h: 260, s: 76, l: 58 },
    { h: 320, s: 74, l: 56 },
    { h: 20, s: 86, l: 56 },
  ],
  [
    { h: 95, s: 76, l: 44 },
    { h: 158, s: 78, l: 50 },
    { h: 212, s: 80, l: 52 },
    { h: 288, s: 70, l: 56 },
  ],
  [
    { h: 350, s: 82, l: 56 },
    { h: 32, s: 90, l: 56 },
    { h: 64, s: 88, l: 54 },
    { h: 200, s: 78, l: 48 },
  ],
  [
    { h: 140, s: 68, l: 46 },
    { h: 186, s: 84, l: 52 },
    { h: 232, s: 84, l: 56 },
    { h: 310, s: 72, l: 56 },
  ],
  [
    { h: 28, s: 88, l: 56 },
    { h: 290, s: 72, l: 56 },
    { h: 210, s: 80, l: 52 },
    { h: 118, s: 70, l: 48 },
  ],
  [
    { h: 10, s: 82, l: 54 },
    { h: 198, s: 80, l: 50 },
    { h: 240, s: 76, l: 54 },
    { h: 300, s: 72, l: 56 },
  ],
  [
    { h: 56, s: 92, l: 56 },
    { h: 18, s: 86, l: 54 },
    { h: 198, s: 84, l: 52 },
    { h: 270, s: 74, l: 56 },
  ],
  [
    { h: 162, s: 78, l: 48 },
    { h: 198, s: 80, l: 52 },
    { h: 248, s: 80, l: 56 },
    { h: 330, s: 70, l: 56 },
  ],
  [
    { h: 280, s: 78, l: 56 },
    { h: 332, s: 78, l: 56 },
    { h: 18, s: 86, l: 54 },
    { h: 92, s: 76, l: 48 },
  ],
  [
    { h: 204, s: 86, l: 54 },
    { h: 176, s: 78, l: 48 },
    { h: 132, s: 68, l: 44 },
    { h: 320, s: 70, l: 56 },
  ],
  [
    { h: 24, s: 90, l: 56 },
    { h: 320, s: 74, l: 56 },
    { h: 220, s: 80, l: 52 },
    { h: 150, s: 70, l: 46 },
  ],
]

function rotatePalette<T>(palette: readonly T[], offset: number) {
  if (offset <= 0) {
    return [...palette]
  }
  return [...palette.slice(offset), ...palette.slice(0, offset)]
}

export function shouldUseAvatarPlaceholder(url?: string | null) {
  return !url || !url.trim()
}

export function buildAvatarBackgroundStyle(seed: string): CSSProperties {
  const paletteIndex = hashString(`${seed}-palette`) % AVATAR_PALETTES.length
  const paletteRotation = hashString(`${seed}-rotation`) % AVATAR_PALETTES[paletteIndex].length
  const palette = rotatePalette(AVATAR_PALETTES[paletteIndex], paletteRotation)
  const [primary, secondary, tertiary, quaternary] = palette
  const conicStart = hashString(`${seed}-conic`) % 360

  const baseColor = hsl(primary.h, primary.s, primary.l)
  const conicA = hsl(primary.h, primary.s + 2, primary.l + 2)
  const conicB = hsl(secondary.h, secondary.s + 2, secondary.l + 2)
  const conicC = hsl(tertiary.h, tertiary.s + 2, tertiary.l + 2)
  const conicD = hsl(quaternary.h, quaternary.s + 2, quaternary.l + 2)
  const blobA = hsl(secondary.h, secondary.s + 4, secondary.l)
  const blobB = hsl(tertiary.h, tertiary.s + 4, tertiary.l)
  const blobC = hsl(quaternary.h, quaternary.s + 2, quaternary.l - 2)
  const overlayA = hsla(primary.h, primary.s + 4, primary.l + 6, 0.3)
  const overlayB = hsla(tertiary.h, tertiary.s + 2, tertiary.l + 4, 0.3)

  return {
    backgroundColor: baseColor,
    backgroundImage: `
      conic-gradient(from ${conicStart}deg, ${conicA}, ${conicB}, ${conicC}, ${conicD}, ${conicA}),
      radial-gradient(at 18% 20%, ${overlayA} 0px, transparent 50%),
      radial-gradient(at 78% 85%, ${overlayB} 0px, transparent 55%),
      radial-gradient(at 18% 74%, ${blobA} 0px, transparent 55%),
      radial-gradient(at 80% 30%, ${blobB} 0px, transparent 55%),
      radial-gradient(at 55% 55%, ${blobC} 0px, transparent 60%),
      radial-gradient(at 25% 22%, rgba(255, 255, 255, 0.55) 0px, transparent 45%),
      radial-gradient(at 82% 88%, rgba(0, 0, 0, 0.3) 0px, transparent 55%)
    `,
    backgroundBlendMode: 'overlay, soft-light, screen, normal, normal, normal, screen, multiply',
    filter: 'saturate(1.1) contrast(1.05)',
    boxShadow: 'inset 0 0 14px rgba(255, 255, 255, 0.22)',
  }
}

export function getAvatarPlaceholderStyle(fallbackSeed: string): CSSProperties {
  return buildAvatarBackgroundStyle(fallbackSeed)
}
