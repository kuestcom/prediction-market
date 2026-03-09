function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function parseCssNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }

  if (trimmed.endsWith('%')) {
    return Number.parseFloat(trimmed.slice(0, -1)) / 100
  }

  return Number.parseFloat(trimmed)
}

function parseCssAngle(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return Number.NaN
  }

  const match = trimmed.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i)
  if (!match) {
    return Number.NaN
  }

  const numericValue = Number.parseFloat(match[1]!)
  if (!Number.isFinite(numericValue)) {
    return Number.NaN
  }

  switch ((match[2] ?? 'deg').toLowerCase()) {
    case 'deg':
      return numericValue
    case 'grad':
      return numericValue * 0.9
    case 'rad':
      return numericValue * (180 / Math.PI)
    case 'turn':
      return numericValue * 360
    default:
      return Number.NaN
  }
}

function parseOklchColor(value: string) {
  const trimmed = value.trim()
  if (!trimmed.toLowerCase().startsWith('oklch(') || !trimmed.endsWith(')')) {
    return null
  }

  const content = trimmed.slice(trimmed.indexOf('(') + 1, -1).trim()
  if (!content) {
    return null
  }

  const [channelsPart, alphaPart] = content.split('/').map(part => part.trim())
  const channels = channelsPart.split(/\s+/).filter(Boolean)
  if (channels.length < 3) {
    return null
  }

  const l = parseCssNumber(channels[0]!)
  const c = Number.parseFloat(channels[1]!)
  const h = parseCssAngle(channels[2]!)
  const alpha = alphaPart ? parseCssNumber(alphaPart) : 1

  if (![l, c, h, alpha].every(channel => Number.isFinite(channel))) {
    return null
  }

  return {
    l,
    c,
    h,
    alpha: clamp(alpha, 0, 1),
  }
}

function formatRgbChannel(value: number) {
  return Math.round(clamp(value, 0, 1) * 255)
}

function formatAlphaChannel(value: number) {
  return Math.round(clamp(value, 0, 1) * 1000) / 1000
}

function convertLinearRgbChannel(value: number) {
  const normalized = clamp(value, 0, 1)
  if (normalized <= 0.0031308) {
    return 12.92 * normalized
  }

  return 1.055 * (normalized ** (1 / 2.4)) - 0.055
}

export function oklchToRenderableColor(value: string) {
  const parsed = parseOklchColor(value)
  if (!parsed) {
    return null
  }

  const hueRadians = (parsed.h * Math.PI) / 180
  const a = parsed.c * Math.cos(hueRadians)
  const b = parsed.c * Math.sin(hueRadians)

  const lComponent = parsed.l + (0.3963377774 * a) + (0.2158037573 * b)
  const mComponent = parsed.l - (0.1055613458 * a) - (0.0638541728 * b)
  const sComponent = parsed.l - (0.0894841775 * a) - (1.291485548 * b)

  const l = lComponent ** 3
  const m = mComponent ** 3
  const s = sComponent ** 3

  const red = convertLinearRgbChannel((4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s))
  const green = convertLinearRgbChannel((-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s))
  const blue = convertLinearRgbChannel((-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s))

  const redChannel = formatRgbChannel(red)
  const greenChannel = formatRgbChannel(green)
  const blueChannel = formatRgbChannel(blue)

  if (parsed.alpha < 1) {
    return `rgba(${redChannel}, ${greenChannel}, ${blueChannel}, ${formatAlphaChannel(parsed.alpha)})`
  }

  return `rgb(${redChannel}, ${greenChannel}, ${blueChannel})`
}
