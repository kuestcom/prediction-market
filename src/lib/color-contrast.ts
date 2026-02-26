function normalizeHex(value: string) {
  const normalized = value.trim().replace('#', '')
  if (normalized.length === 3) {
    return normalized.split('').map(char => `${char}${char}`).join('')
  }
  return normalized
}

function toHex(channel: number) {
  return channel.toString(16).padStart(2, '0')
}

export function hexToRgb(color: string) {
  const normalized = normalizeHex(color)
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function toLinearChannel(channel: number) {
  const normalized = channel / 255
  if (normalized <= 0.04045) {
    return normalized / 12.92
  }
  return ((normalized + 0.055) / 1.055) ** 2.4
}

export function getRelativeLuminance(color: string) {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return null
  }

  const r = toLinearChannel(rgb.r)
  const g = toLinearChannel(rgb.g)
  const b = toLinearChannel(rgb.b)
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
}

export function mixWithWhite(color: string, ratio: number) {
  const rgb = hexToRgb(color)
  if (!rgb) {
    return color
  }

  const clampedRatio = Math.max(0, Math.min(1, ratio))
  function blend(channel: number) {
    return Math.round(channel + (255 - channel) * clampedRatio)
  }

  return `#${toHex(blend(rgb.r))}${toHex(blend(rgb.g))}${toHex(blend(rgb.b))}`
}

interface EnsureReadableTextColorOptions {
  minLuminance?: number
  mixRatioWhenTooDark?: number
}

export function ensureReadableTextColorOnDark(
  color: string | null | undefined,
  options: EnsureReadableTextColorOptions = {},
) {
  if (!color) {
    return null
  }

  const minLuminance = options.minLuminance ?? 0.18
  const mixRatioWhenTooDark = options.mixRatioWhenTooDark ?? 0.62
  const luminance = getRelativeLuminance(color)

  if (luminance == null) {
    return color
  }

  if (luminance < minLuminance) {
    return mixWithWhite(color, mixRatioWhenTooDark)
  }

  return color
}
