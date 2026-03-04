import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createOpenAPI } from 'fumadocs-openapi/server'

function resolveServerUrl(envValue: string | undefined): string | undefined {
  const value = envValue?.trim()

  if (!value) {
    return undefined
  }

  return value
}

export const OPENAPI_SERVER_URLS = {
  clob: resolveServerUrl(process.env.CLOB_URL),
  createMarket: resolveServerUrl(process.env.CREATE_MARKET_URL),
  community: resolveServerUrl(process.env.COMMUNITY_URL),
  dataApi: resolveServerUrl(process.env.DATA_URL),
  priceReference: resolveServerUrl(process.env.PRICE_REFERENCE_URL),
  relayer: resolveServerUrl(process.env.RELAYER_URL),
} as const

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

async function readSchema(schemaPath: string): Promise<OpenApiSchema> {
  const schemaFilePath = path.resolve(process.cwd(), schemaPath)
  const schemaContents = await readFile(schemaFilePath, 'utf8')
  return JSON.parse(schemaContents) as OpenApiSchema
}

export const openapi = createOpenAPI({
  input: async () => {
    const [
      clobSchema,
      createMarketSchema,
      communitySchema,
      dataApiSchema,
      priceReferenceSchema,
      relayerSchema,
    ] = await Promise.all([
      readSchema('./docs/api-reference/schemas/openapi-clob.json'),
      readSchema('./docs/api-reference/schemas/openapi-create-market.json'),
      readSchema('./docs/api-reference/schemas/openapi-community.json'),
      readSchema('./docs/api-reference/schemas/openapi-data-api.json'),
      readSchema('./docs/api-reference/schemas/openapi-price-reference.json'),
      readSchema('./docs/api-reference/schemas/openapi-relayer.json'),
    ])

    return {
      'clob': applyServerUrl(clobSchema, OPENAPI_SERVER_URLS.clob),
      'create-market': applyServerUrl(createMarketSchema, OPENAPI_SERVER_URLS.createMarket),
      'community': applyServerUrl(communitySchema, OPENAPI_SERVER_URLS.community),
      'data-api': applyServerUrl(dataApiSchema, OPENAPI_SERVER_URLS.dataApi),
      'price-reference': applyServerUrl(priceReferenceSchema, OPENAPI_SERVER_URLS.priceReference),
      'relayer': applyServerUrl(relayerSchema, OPENAPI_SERVER_URLS.relayer),
    }
  },
  proxyUrl: '/docs/api/proxy',
})
