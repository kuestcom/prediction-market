import { describe, expect, it } from 'vitest'
import {
  buildSvgDataUri,
  createDefaultThemeSiteIdentity,
  sanitizeThemeSiteLogoSvg,
  validateThemeSiteDescription,
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
})
