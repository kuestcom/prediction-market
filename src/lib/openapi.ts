import type { OpenAPIV3_2 } from 'fumadocs-openapi'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { OPENAPI_SERVER_URLS } from '@/lib/openapi-servers'

type SchemaServer = Record<string, unknown> & {
  url?: string
}

type OpenApiSchema = OpenAPIV3_2.Document & {
  servers?: SchemaServer[]
}

function applyServerUrl(schema: OpenApiSchema, serverUrl?: string): OpenApiSchema {
  if (!serverUrl) {
    return schema
  }

  const existingServers = Array.isArray(schema.servers) ? schema.servers : []

  if (existingServers.length === 0) {
    return {
      ...schema,
      servers: [{ url: serverUrl }],
    }
  }

  return {
    ...schema,
    servers: existingServers.map((server, index) => {
      if (index !== 0) {
        return server
      }

      return {
        ...server,
        url: serverUrl,
      }
    }),
  }
}

async function readSchema(schemaFileName: string): Promise<OpenApiSchema> {
  const schemaFilePath = path.join(process.cwd(), 'docs', 'api-reference', 'schemas', schemaFileName)
  const schemaContents = await readFile(schemaFilePath, 'utf8')
  return JSON.parse(schemaContents) as OpenApiSchema
}

async function loadSchemaWithServerUrl(schemaFileName: string, serverUrl?: string) {
  const schema = await readSchema(schemaFileName)
  return applyServerUrl(schema, serverUrl)
}

export const openapi = createOpenAPI({
  input: {
    'clob': () => loadSchemaWithServerUrl('openapi-clob.json', OPENAPI_SERVER_URLS.clob),
    'create-market': () => loadSchemaWithServerUrl('openapi-create-market.json', OPENAPI_SERVER_URLS.createMarket),
    'data-api': () => loadSchemaWithServerUrl('openapi-data-api.json', OPENAPI_SERVER_URLS.dataApi),
    'gamma': () => loadSchemaWithServerUrl('openapi-gamma.json', OPENAPI_SERVER_URLS.gamma),
    'price-reference': () => loadSchemaWithServerUrl('openapi-price-reference.json', OPENAPI_SERVER_URLS.priceReference),
    'relayer': () => loadSchemaWithServerUrl('openapi-relayer.json', OPENAPI_SERVER_URLS.relayer),
  },
  proxyUrl: '/docs/api/proxy',
})
