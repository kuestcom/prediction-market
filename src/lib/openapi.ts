import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { resolveServiceUrls } from '@/lib/service-urls'

type SchemaServer = Record<string, unknown> & {
  url?: string
}

type OpenApiSchema = Record<string, unknown> & {
  servers?: SchemaServer[]
}

function applyServerUrl(schema: OpenApiSchema, serverUrl: string): OpenApiSchema {
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
    const serviceUrls = resolveServiceUrls()
    const [
      clobSchema,
      clobExtendedSchema,
      createMarketSchema,
      communitySchema,
      dataApiSchema,
      priceReferenceSchema,
      relayerSchema,
    ] = await Promise.all([
      readSchema('./docs/api-reference/schemas/openapi.json'),
      readSchema('./docs/api-reference/schemas/openapi2.json'),
      readSchema('./docs/api-reference/schemas/openapi-create-market.json'),
      readSchema('./docs/api-reference/schemas/openapi-community.json'),
      readSchema('./docs/api-reference/schemas/openapi-data-api.json'),
      readSchema('./docs/api-reference/schemas/openapi-price-reference.json'),
      readSchema('./docs/api-reference/schemas/openapi-relayer.json'),
    ])

    return {
      'clob': applyServerUrl(clobSchema, serviceUrls.clobUrl),
      'clob-extended': applyServerUrl(clobExtendedSchema, serviceUrls.clobUrl),
      'create-market': applyServerUrl(createMarketSchema, serviceUrls.createMarketUrl),
      'community': applyServerUrl(communitySchema, serviceUrls.communityUrl),
      'data-api': applyServerUrl(dataApiSchema, serviceUrls.dataUrl),
      'price-reference': applyServerUrl(priceReferenceSchema, serviceUrls.priceReferenceUrl),
      'relayer': applyServerUrl(relayerSchema, serviceUrls.relayerUrl),
    }
  },
  proxyUrl: '/docs/api/proxy',
})
