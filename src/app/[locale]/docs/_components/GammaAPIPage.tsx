import type { GeneratedPageProps } from 'fumadocs-openapi'
import GammaOpenAPIPage from '@/app/[locale]/docs/_components/GammaAPIPage.client'
import { openapi } from '@/lib/openapi'

export async function GammaAPIPage({ document, ...props }: GeneratedPageProps) {
  const schema = await openapi.getSchema(document)

  return (
    <GammaOpenAPIPage
      {...props}
      payload={{
        bundled: schema.bundled,
        proxyUrl: openapi.options.proxyUrl,
      }}
    />
  )
}
