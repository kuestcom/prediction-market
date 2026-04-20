import type { LucideIcon } from 'lucide-react'
import { getSlugs, loader } from 'fumadocs-core/source'
import { docs } from 'fumadocs-mdx:collections/server'
import { openapiPlugin } from 'fumadocs-openapi/server'
import * as lucideIcons from 'lucide-react'
import { createElement } from 'react'

function isLucideIcon(value: unknown): value is LucideIcon {
  return typeof value === 'function'
    || (typeof value === 'object' && value !== null && '$$typeof' in value)
}

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [openapiPlugin()],
  slugs(file) {
    const slugs = getSlugs(file.path)
    if (slugs[0] !== 'users') {
      return slugs
    }
    return slugs.slice(1)
  },
  icon(icon) {
    if (!icon) {
      return
    }
    const candidates = [icon, `${icon}Icon`]
    for (const name of candidates) {
      const component = lucideIcons[name as keyof typeof lucideIcons]
      if (isLucideIcon(component)) {
        return createElement(component)
      }
    }
  },
})
