import type { ClassValue } from 'clsx'
import confetti from 'canvas-confetti'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { IS_BROWSER } from '@/lib/constants'

export const NEW_MARKET_MAX_AGE_DAYS = 2
const MS_IN_DAY = 86_400_000

export function isMarketNew(createdAt: string, thresholdDays: number = NEW_MARKET_MAX_AGE_DAYS, currentTime?: number) {
  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) {
    return false
  }

  const now = currentTime ?? Date.now()
  const diffInMs = now - createdDate.getTime()
  return diffInMs <= thresholdDays * MS_IN_DAY
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DISALLOWED_ELEMENT_TAGS_WITH_CONTENT = [
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'style',
] as const

const DISALLOWED_ELEMENT_TAGS_SELF_CLOSING = [
  'link',
  'meta',
  'base',
] as const

const DROP_TAGS_BUT_KEEP_CONTENT = [
  'a',
  'use',
] as const

function stripElementBlocks(svg: string, tag: string) {
  const openTag = `<${tag}`
  const closeTag = `</${tag}>`
  const lower = svg.toLowerCase()
  let cursor = 0
  let sanitized = ''

  while (cursor < svg.length) {
    const start = lower.indexOf(openTag, cursor)
    if (start === -1) {
      sanitized += svg.slice(cursor)
      break
    }

    sanitized += svg.slice(cursor, start)
    const end = lower.indexOf(closeTag, start)
    if (end === -1) {
      break
    }

    cursor = end + closeTag.length
  }

  return sanitized
}

function stripScriptTags(svg: string) {
  return stripElementBlocks(svg, 'script')
}

function stripDangerousElements(svg: string) {
  let sanitized = svg

  for (const tag of DISALLOWED_ELEMENT_TAGS_WITH_CONTENT) {
    sanitized = stripElementBlocks(sanitized, tag)
  }

  if (DISALLOWED_ELEMENT_TAGS_SELF_CLOSING.length) {
    const selfClosingTags = DISALLOWED_ELEMENT_TAGS_SELF_CLOSING.join('|')
    sanitized = sanitized.replace(new RegExp(`<\\s*(?:${selfClosingTags})\\b[^>]*\>`, 'gi'), '')
  }

  if (DROP_TAGS_BUT_KEEP_CONTENT.length) {
    const droppedTags = DROP_TAGS_BUT_KEEP_CONTENT.join('|')
    sanitized = sanitized.replace(new RegExp(`<\\/?\\s*(?:${droppedTags})\\b[^>]*>`, 'gi'), '')
  }

  sanitized = sanitized
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[cdata\[[\s\S]*?\]\]>/gi, '')

  return sanitized
}

function isSafeDataImageUrl(value: string) {
  const normalized = value.trim().toLowerCase()
  return /^data:image\/(?:png|jpe?g|gif|webp)\b/.test(normalized)
}

function sanitizeUrlAttribute(match: string, quotedValue?: string, singleQuotedValue?: string, rawValue?: string) {
  const value = (quotedValue ?? singleQuotedValue ?? rawValue ?? '').trim()
  const normalized = value.toLowerCase()

  if (!value) {
    return ''
  }

  if (value.startsWith('#')) {
    const escaped = value.replace(/"/g, '&quot;')
    return match.startsWith(' xlink:href') ? ` xlink:href="${escaped}"` : ` href="${escaped}"`
  }

  if (isSafeDataImageUrl(value)) {
    const escaped = value.replace(/"/g, '&quot;')
    return match.startsWith(' xlink:href') ? ` xlink:href="${escaped}"` : ` href="${escaped}"`
  }

  if (normalized.startsWith('data:') || normalized.startsWith('javascript:') || normalized.startsWith('http:') || normalized.startsWith('https:')) {
    return ''
  }

  return ''
}

function stripUnsafeUrlPaintAttributes(svg: string) {
  const urlPaintAttrs = [
    'fill',
    'stroke',
    'filter',
    'clip-path',
    'mask',
  ]

  let sanitized = svg

  for (const attr of urlPaintAttrs) {
    const pattern = new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'gi')
    sanitized = sanitized.replace(pattern, (full, q1, q2, q3) => {
      const value = String(q1 ?? q2 ?? q3 ?? '').trim()
      const normalized = value.toLowerCase()

      if (!value) {
        return ''
      }

      if (normalized.includes('url(')) {
        const isInternal = /url\(\s*['"]?#/i.test(value)
        return isInternal ? full : ''
      }

      return full
    })
  }

  return sanitized
}

export function sanitizeSvg(svg: string) {
  let sanitized = stripDangerousElements(svg)

  sanitized = stripScriptTags(sanitized)
  sanitized = sanitized.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  sanitized = sanitized.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/data:(?!image\/(?:png|jpe?g|gif|webp)\b)/gi, '')
  sanitized = sanitized.replace(/\s(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, sanitizeUrlAttribute)
  sanitized = sanitized.replace(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, '')

  sanitized = stripUnsafeUrlPaintAttributes(sanitized)

  return sanitized
}

export function triggerConfetti(color: 'primary' | 'yes' | 'no', event?: any) {
  let origin: { x?: number, y: number } = { y: 0.6 }

  if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    const x = event.clientX / window.innerWidth
    const y = event.clientY / window.innerHeight
    origin = { x, y }
  }

  const colors = {
    yes: ['#10b981', '#059669', '#047857', '#065f46'],
    no: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
    primary: ['#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa'],
  }[color ?? 'primary']

  confetti({
    particleCount: 120,
    spread: 70,
    decay: 0.92,
    scalar: 0.9,
    origin,
    colors,
  })
}

export function triggerConfettiColorful(event?: any) {
  let origin: { x?: number, y: number } = { y: 0.6 }

  if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    const x = event.clientX / window.innerWidth
    const y = event.clientY / window.innerHeight
    origin = { x, y }
  }

  const colors = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#22c55e',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
  ]

  confetti({
    particleCount: 120,
    spread: 70,
    decay: 0.92,
    scalar: 0.9,
    origin,
    colors,
  })
}

export function calculateWinnings(amount: number, price: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(price) || amount <= 0 || price <= 0) {
    return 0
  }

  return amount / price - amount
}

export function clearBrowserStorage() {
  if (!IS_BROWSER) {
    return
  }

  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }
  catch {
    //
  }
}

export function clearNonHttpOnlyCookies() {
  if (typeof document === 'undefined') {
    return
  }

  const cookies = document.cookie.split(';')
  cookies.forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim()
    if (!name) {
      return
    }

    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`
  })
}
