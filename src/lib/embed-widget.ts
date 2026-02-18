const EMBED_SCRIPT_URL = 'https://unpkg.com/@kuestcom/embeds/dist/index.js'

type EmbedTheme = 'light' | 'dark'

function appendAffiliateRef(params: URLSearchParams, affiliateCode?: string) {
  const sanitized = affiliateCode?.trim()
  if (!sanitized || params.has('r')) {
    return
  }
  params.set('r', sanitized)
}

export function buildFeatureList(showVolume: boolean, showChart: boolean, showTimeRange: boolean) {
  const features: string[] = []
  if (showVolume) {
    features.push('volume')
  }
  if (showChart) {
    features.push('chart')
  }
  if (showChart && showTimeRange) {
    features.push('filters')
  }
  return features
}

export function buildIframeSrc(
  baseUrl: string,
  marketSlug: string,
  theme: EmbedTheme,
  features: string[],
  affiliateCode?: string,
) {
  if (!marketSlug) {
    return ''
  }

  const params = new URLSearchParams({ market: marketSlug, theme })
  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  appendAffiliateRef(params, affiliateCode)

  return `${baseUrl}/market.html?${params.toString()}`
}

export function buildPreviewSrc(
  marketSlug: string,
  theme: EmbedTheme,
  features: string[],
  affiliateCode?: string,
) {
  if (!marketSlug) {
    return ''
  }

  const params = new URLSearchParams({ market: marketSlug, theme })
  if (features.length > 0) {
    params.set('features', features.join(','))
  }
  appendAffiliateRef(params, affiliateCode)

  return `/market.html?${params.toString()}`
}

export function buildIframeCode(src: string, height: number, iframeTitle: string) {
  return [
    '<iframe',
    `\ttitle="${iframeTitle}"`,
    `\tsrc="${src}"`,
    '\twidth="400"',
    `\theight="${height}"`,
    '\tframeBorder="0"',
    '/>',
  ].join('\n')
}

export function buildWebComponentCode(
  elementName: string,
  marketSlug: string,
  theme: EmbedTheme,
  showVolume: boolean,
  showChart: boolean,
  showTimeRange: boolean,
  affiliateCode?: string,
) {
  const lines = [
    `<div id="${elementName}">`,
    '\t<script',
    '\t\ttype="module"',
    `\t\tsrc="${EMBED_SCRIPT_URL}"`,
    '\t>',
    '\t</script>',
    `\t<${elementName}`,
    `\t\tmarket="${marketSlug}"`,
  ]

  if (showVolume) {
    lines.push('\t\tvolume="true"')
  }
  if (showChart) {
    lines.push('\t\tchart="true"')
  }
  if (showChart && showTimeRange) {
    lines.push('\t\tfilters="true"')
  }
  if (affiliateCode?.trim()) {
    lines.push(`\t\taffiliate="${affiliateCode.trim()}"`)
  }

  lines.push(`\t\ttheme="${theme}"`)
  lines.push('\t/>')
  lines.push('</div>')
  return lines.join('\n')
}

export { EMBED_SCRIPT_URL }
export type { EmbedTheme }
