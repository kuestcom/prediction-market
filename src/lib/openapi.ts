import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { OPENAPI_SERVER_URLS } from '@/lib/openapi-servers'

type SchemaServer = Record<string, unknown> & {
  url?: string
}

type OpenApiSchema = Record<string, unknown> & {
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

async function loadOpenApiSchemas() {
  const [
    clobSchema,
    createMarketSchema,
    dataApiSchema,
    gammaSchema,
    priceReferenceSchema,
    relayerSchema,
  ] = await Promise.all([
    readSchema('openapi-clob.json'),
    readSchema('openapi-create-market.json'),
    readSchema('openapi-data-api.json'),
    readSchema('openapi-gamma.json'),
    readSchema('openapi-price-reference.json'),
    readSchema('openapi-relayer.json'),
  ])

  return {
    'clob': applyServerUrl(clobSchema, OPENAPI_SERVER_URLS.clob),
    'create-market': applyServerUrl(createMarketSchema, OPENAPI_SERVER_URLS.createMarket),
    'data-api': applyServerUrl(dataApiSchema, OPENAPI_SERVER_URLS.dataApi),
    'gamma': applyServerUrl(gammaSchema, OPENAPI_SERVER_URLS.gamma),
    'price-reference': applyServerUrl(priceReferenceSchema, OPENAPI_SERVER_URLS.priceReference),
    'relayer': applyServerUrl(relayerSchema, OPENAPI_SERVER_URLS.relayer),
  }
}

let openApiSchemasPromise: ReturnType<typeof loadOpenApiSchemas> | null = null

function getOpenApiSchemas() {
  openApiSchemasPromise ??= loadOpenApiSchemas()
  return openApiSchemasPromise
}

export const openapi = createOpenAPI({
  input: getOpenApiSchemas,
  proxyUrl: '/docs/api/proxy',
})
