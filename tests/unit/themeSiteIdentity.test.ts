import { describe, expect, it } from 'vitest'
import {
  buildSvgDataUri,
  createDefaultThemeSiteIdentity,
  sanitizeThemeSiteLogoSvg,
  validateThemeSiteDescription,
  validateThemeSiteExternalUrl,
  validateThemeSiteGoogleAnalyticsId,
  validateThemeSiteLogoMode,
  validateThemeSiteName,
} from '@/lib/theme-site-identity'

describe('theme site identity helpers', () => {
  it('builds default identity with sane values', () => {
    const identity = createDefaultThemeSiteIdentity()

    expect(identity.name).toBeTruthy()
    expect(identity.description).toBeTruthy()
    expect(identity.logoSvg).toContain('<svg')
    expect(identity.logoUrl).toContain('data:image/svg+xml;utf8,')
    expect(identity.googleAnalyticsId).toBeNull()
    expect(identity.discordLink).toBeNull()
    expect(identity.supportUrl).toBeNull()
  })

  it('validates required name and description fields', () => {
    expect(validateThemeSiteName('', 'Site name').error).toContain('required')
    expect(validateThemeSiteDescription('', 'Site description').error).toContain('required')
    expect(validateThemeSiteName('Kuest', 'Site name')).toEqual({ value: 'Kuest', error: null })
  })

  it('validates logo mode', () => {
    expect(validateThemeSiteLogoMode('svg', 'Logo type')).toEqual({ value: 'svg', error: null })
    expect(validateThemeSiteLogoMode('image', 'Logo type')).toEqual({ value: 'image', error: null })
    expect(validateThemeSiteLogoMode('custom', 'Logo type').error).toContain('invalid')
  })

  it('sanitizes SVG logo payloads', () => {
    const result = sanitizeThemeSiteLogoSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>',
      'Logo SVG',
    )

    expect(result.error).toBeNull()
    expect(result.value).toContain('<svg')
    expect(result.value).not.toContain('<script')
  })

  it('builds SVG data URI', () => {
    const uri = buildSvgDataUri('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true)
  })

  it('validates optional analytics id and links', () => {
    expect(validateThemeSiteGoogleAnalyticsId('', 'Google Analytics ID')).toEqual({ value: null, error: null })
    expect(validateThemeSiteGoogleAnalyticsId('G-TEST123', 'Google Analytics ID')).toEqual({ value: 'G-TEST123', error: null })
    expect(validateThemeSiteGoogleAnalyticsId('bad id', 'Google Analytics ID').error).toContain('invalid format')

    expect(validateThemeSiteExternalUrl('', 'Discord link')).toEqual({ value: null, error: null })
    expect(validateThemeSiteExternalUrl('discord.gg/kuest', 'Discord link')).toEqual({ value: 'https://discord.gg/kuest', error: null })
    expect(validateThemeSiteExternalUrl('ftp://example.com', 'Discord link').error).toContain('http:// or https://')
  })
})
