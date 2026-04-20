import { describe, expect, it } from 'vitest'
import {
  isCustomJavascriptCodeEnabledOnPathname,
  parseCustomJavascriptCodeTags,
  resolveCustomJavascriptCodePageBucket,
  validateCustomJavascriptCodesJson,
} from '@/lib/custom-javascript-code'

describe('custom javascript code helpers', () => {
  it('parses raw JavaScript into a single inline script tag entry', () => {
    const scripts = parseCustomJavascriptCodeTags('window.CRISP_WEBSITE_ID = "site_123"')

    expect(scripts).toEqual([
      {
        id: 'custom-javascript-code-tag-0',
        attributes: {},
        content: 'window.CRISP_WEBSITE_ID = "site_123"',
      },
    ])
  })

  it('parses multiple script tags and preserves key attributes', () => {
    const scripts = parseCustomJavascriptCodeTags(`
      <script>window.$crisp = [];</script>
      <script async src="https://client.crisp.chat/l.js" crossorigin="anonymous"></script>
    `)

    expect(scripts).toEqual([
      {
        id: 'custom-javascript-code-tag-0',
        attributes: {},
        content: 'window.$crisp = [];',
      },
      {
        id: 'custom-javascript-code-tag-1',
        attributes: {
          async: true,
          crossOrigin: 'anonymous',
          src: 'https://client.crisp.chat/l.js',
        },
        content: null,
      },
    ])
  })

  it('validates custom javascript codes json and keeps disable rules', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Crisp',
        snippet: '<script>window.$crisp = [];</script>',
        disabledOn: ['admin', 'portfolio'],
      },
    ]), 'Custom javascript code')

    expect(result.error).toBeNull()
    expect(result.value).toEqual([
      {
        name: 'Crisp',
        snippet: '<script>window.$crisp = [];</script>',
        disabledOn: ['admin', 'portfolio'],
      },
    ])
  })

  it('allows raw javascript snippets that include comparison operators', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Counter',
        snippet: 'if (count < 10) { window.count = count + 1 }',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result.error).toBeNull()
    expect(result.value).toEqual([
      {
        name: 'Counter',
        snippet: 'if (count < 10) { window.count = count + 1 }',
        disabledOn: [],
      },
    ])
  })

  it('allows raw javascript snippets with identifier comparisons', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Guard',
        snippet: 'if (x<Y) { window.guard = true }',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result.error).toBeNull()
    expect(result.value).toEqual([
      {
        name: 'Guard',
        snippet: 'if (x<Y) { window.guard = true }',
        disabledOn: [],
      },
    ])
  })

  it('allows raw javascript snippets with regex literals that include html-like text', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Pattern guard',
        snippet: 'const htmlPattern = /<(div|span)>/i\nwindow.isHtmlTag = htmlPattern.test(tagName)',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result.error).toBeNull()
    expect(result.value).toEqual([
      {
        name: 'Pattern guard',
        snippet: 'const htmlPattern = /<(div|span)>/i\nwindow.isHtmlTag = htmlPattern.test(tagName)',
        disabledOn: [],
      },
    ])
  })

  it('allows regex literals after division operators', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Division regex',
        snippet: 'const ratio = 1 / /<(div|span)>/i.test(tagName)',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result.error).toBeNull()
    expect(result.value).toEqual([
      {
        name: 'Division regex',
        snippet: 'const ratio = 1 / /<(div|span)>/i.test(tagName)',
        disabledOn: [],
      },
    ])
  })

  it('rejects markup that is not raw JavaScript or a script snippet', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Broken',
        snippet: '<div>bad</div>',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result).toEqual({
      value: null,
      valueJson: '',
      error: 'Custom javascript code 1 snippet must be raw JavaScript or a provider <script> snippet.',
    })
  })

  it('rejects non-script html that appears later in the snippet', () => {
    const result = validateCustomJavascriptCodesJson(JSON.stringify([
      {
        name: 'Broken later',
        snippet: 'window.ready = true\n<div>bad</div>',
        disabledOn: [],
      },
    ]), 'Custom javascript code')

    expect(result).toEqual({
      value: null,
      valueJson: '',
      error: 'Custom javascript code 1 snippet must be raw JavaScript or a provider <script> snippet.',
    })
  })

  it('maps pathname buckets and enables scripts only on allowed pages', () => {
    expect(resolveCustomJavascriptCodePageBucket('/')).toBe('home')
    expect(resolveCustomJavascriptCodePageBucket('/portfolio')).toBe('portfolio')
    expect(resolveCustomJavascriptCodePageBucket('/settings')).toBe('settings')
    expect(resolveCustomJavascriptCodePageBucket('/settings/trading')).toBe('settings')
    expect(resolveCustomJavascriptCodePageBucket('/docs')).toBe('docs')
    expect(resolveCustomJavascriptCodePageBucket('/docs/getting-started/how-to-sign-up')).toBe('docs')
    expect(resolveCustomJavascriptCodePageBucket('/admin/theme')).toBe('admin')
    expect(resolveCustomJavascriptCodePageBucket('/event')).toBe('other')
    expect(resolveCustomJavascriptCodePageBucket('/event/will-btc-rise')).toBe('event')

    expect(isCustomJavascriptCodeEnabledOnPathname({
      disabledOn: ['admin'],
    }, '/admin')).toBe(false)
    expect(isCustomJavascriptCodeEnabledOnPathname({
      disabledOn: ['event'],
    }, '/event/will-btc-rise')).toBe(false)
    expect(isCustomJavascriptCodeEnabledOnPathname({
      disabledOn: ['settings'],
    }, '/settings/trading')).toBe(false)
    expect(isCustomJavascriptCodeEnabledOnPathname({
      disabledOn: ['docs'],
    }, '/docs/getting-started/how-to-sign-up')).toBe(false)
    expect(isCustomJavascriptCodeEnabledOnPathname({
      disabledOn: ['portfolio'],
    }, '/')).toBe(true)
  })
})
