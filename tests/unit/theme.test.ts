import { describe, expect, it } from 'vitest'
import {
  buildResolvedThemeConfig,
  buildThemeCssText,
  parseThemeOverridesJson,
  resolveThemePreset,
  sortThemeOverrides,
  validateThemeRadius,
} from '@/lib/theme'

describe('theme helpers', () => {
  it('parses JSON overrides with supported token names', () => {
    const parsed = parseThemeOverridesJson(
      '{"--primary":"#112233","chart-1":"oklch(0.7 0.2 145)"}',
      'Light theme overrides',
    )

    expect(parsed.error).toBeNull()
    expect(parsed.data).toEqual({
      'primary': '#112233',
      'chart-1': 'oklch(0.7 0.2 145)',
    })
  })

  it('rejects unsupported tokens', () => {
    const parsed = parseThemeOverridesJson(
      '{"not-allowed":"#112233"}',
      'Light theme overrides',
    )

    expect(parsed.error).toBe('Unsupported theme token: "not-allowed".')
    expect(parsed.data).toBeNull()
  })

  it('rejects invalid color formats', () => {
    const parsed = parseThemeOverridesJson(
      '{"primary":"rgb(255,0,0)"}',
      'Light theme overrides',
    )

    expect(parsed.error).toBe('Invalid color for "primary". Supported formats: hex and oklch().')
    expect(parsed.data).toBeNull()
  })

  it('validates radius values', () => {
    expect(validateThemeRadius('10px', 'Corner roundness')).toEqual({ value: '10px', error: null })
    expect(validateThemeRadius('0.75rem', 'Corner roundness')).toEqual({ value: '0.75rem', error: null })
    expect(validateThemeRadius('12', 'Corner roundness').error).toContain('valid CSS length')
  })

  it('sorts overrides in stable token order', () => {
    const sorted = sortThemeOverrides({
      foreground: '#223344',
      background: '#112233',
    })

    expect(Object.keys(sorted)).toEqual(['background', 'foreground'])
  })

  it('falls back to default preset when preset id is invalid', () => {
    const resolution = resolveThemePreset('does-not-exist')
    expect(resolution.preset.id).toBe('default')
    expect(resolution.usedFallbackPreset).toBe(true)
  })

  it('builds custom override css without forcing preset defaults', () => {
    const resolved = buildResolvedThemeConfig(
      'midnight',
      { primary: '#112233' },
      { primary: '#445566' },
      '8px',
    )

    expect(resolved.light.primary).toBe('#112233')
    expect(resolved.dark.primary).toBe('#445566')
    expect(resolved.radius).toBe('8px')
    expect(resolved.cssText).toContain(':root {')
    expect(resolved.cssText).toContain('.dark,')
    expect(resolved.cssText).toContain('[data-theme-mode=\'dark\'],')
    expect(resolved.cssText).toContain('.dark[data-theme-preset],')
    expect(resolved.cssText).toContain('[data-theme-mode=\'dark\'][data-theme-preset] {')
    expect(resolved.cssText).toContain('--radius: 8px;')
    expect(resolved.cssText).toContain('--primary: #112233;')
    expect(resolved.cssText).not.toContain('--background: oklch(0.22 0.03 266);')
  })

  it('applies dark background override over preset-specific dark values', () => {
    const presetStyle = document.createElement('style')
    presetStyle.textContent = `
.dark[data-theme-preset='midnight'],
[data-theme-mode='dark'][data-theme-preset='midnight'] {
  --background: oklch(0.22 0.03 266);
}
`.trim()

    const overrideStyle = document.createElement('style')
    overrideStyle.textContent = buildThemeCssText({}, { background: '#123456' })

    const darkClassProbe = document.createElement('div')
    darkClassProbe.className = 'dark'
    darkClassProbe.setAttribute('data-theme-preset', 'midnight')

    const darkDataModeProbe = document.createElement('div')
    darkDataModeProbe.setAttribute('data-theme-mode', 'dark')
    darkDataModeProbe.setAttribute('data-theme-preset', 'midnight')

    document.head.append(presetStyle, overrideStyle)
    document.body.append(darkClassProbe, darkDataModeProbe)

    const classModeBackground = getComputedStyle(darkClassProbe).getPropertyValue('--background').trim()
    const dataModeBackground = getComputedStyle(darkDataModeProbe).getPropertyValue('--background').trim()

    expect(classModeBackground).toBe('#123456')
    expect(dataModeBackground).toBe('#123456')

    darkClassProbe.remove()
    darkDataModeProbe.remove()
    overrideStyle.remove()
    presetStyle.remove()
  })
})
