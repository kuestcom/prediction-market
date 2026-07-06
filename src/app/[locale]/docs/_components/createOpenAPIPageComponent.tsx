import type { GeneratedPageProps } from 'fumadocs-openapi'
import type { OpenAPIPageProps } from 'fumadocs-openapi/ui'
import type { ComponentType } from 'react'
import { openapi } from '@/lib/openapi'

export function createOpenAPIPageComponent(OpenAPIPage: ComponentType<OpenAPIPageProps>) {
  return async function OpenAPIPageComponent({ document, ...props }: GeneratedPageProps) {
    const schema = await openapi.getSchema(document)

    return (
      <OpenAPIPage
        {...props}
        payload={{
          bundled: schema.bundled,
          proxyUrl: openapi.options.proxyUrl,
        }}
      />
    )
  }
}
