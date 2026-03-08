import { source } from '@/lib/source'

function normalizeDescription(description?: string) {
  return description?.replace(/\s+/g, ' ').trim()
}

export function GET() {
  const pages = [...source.getPages()].sort((left, right) => left.url.localeCompare(right.url))

  const lines = [
    '# Documentation',
    '',
    '> Index of the documentation pages available on this site.',
    '> Use /llms-full.txt for the full page contents.',
    '',
    '## Pages',
    ...pages.map((page) => {
      const title = page.data.title ?? page.url
      const description = normalizeDescription(page.data.description)

      if (!description) {
        return `- [${title}](${page.url})`
      }

      return `- [${title}](${page.url}): ${description}`
    }),
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
