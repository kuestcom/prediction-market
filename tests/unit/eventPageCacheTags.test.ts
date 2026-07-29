import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const cachedEventPages = [
  {
    functionName: 'CachedEventPageContent',
    path: 'src/app/[locale]/(platform)/event/[slug]/page.tsx',
  },
  {
    functionName: 'CachedEventMarketPageContent',
    path: 'src/app/[locale]/(platform)/event/[slug]/[market]/page.tsx',
  },
] as const

describe('event page cache tags', () => {
  it.each(cachedEventPages)('tags $functionName with its event slug', ({ functionName, path }) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    const functionStart = source.indexOf(`async function ${functionName}`)
    const functionEnd = source.indexOf('\nexport default', functionStart)

    expect(functionStart).toBeGreaterThanOrEqual(0)
    expect(functionEnd).toBeGreaterThan(functionStart)

    const cachedFunction = source.slice(functionStart, functionEnd)

    expect(cachedFunction).toContain("'use cache'")
    expect(cachedFunction).toContain('cacheTag(cacheTags.event(slug))')
  })
})
