import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface OpenApiDocument {
  paths?: Record<string, Record<string, unknown>>
}

async function readOpenApiDocument() {
  const schemaPath = path.join(process.cwd(), 'docs/api-reference/schemas/openapi-clob.json')
  return JSON.parse(await readFile(schemaPath, 'utf8')) as OpenApiDocument
}

async function readDocumentationPage() {
  const pagePath = path.join(process.cwd(), 'docs/api-reference/market-data/get-neg-risk-by-path.mdx')
  return await readFile(pagePath, 'utf8')
}

describe('OpenAPI documentation references', () => {
  it('references the schema path for the neg-risk token endpoint', async () => {
    const [document, page] = await Promise.all([readOpenApiDocument(), readDocumentationPage()])

    expect(document.paths?.['/neg-risk']?.get).toBeDefined()
    expect(page).toContain("path: '/neg-risk'")
    expect(page).not.toContain("path: '/neg-risk/{token_id}'")
  })
})
