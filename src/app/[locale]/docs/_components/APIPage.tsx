import type { GeneratedPageProps } from 'fumadocs-openapi'
import OpenAPIPage from '@/app/[locale]/docs/_components/APIPage.client'
import { openapi } from '@/lib/openapi'

export async function APIPage({ document, ...props }: GeneratedPageProps) {
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
