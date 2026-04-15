import { createAPIPage } from 'fumadocs-openapi/ui'
import client from '@/app/[locale]/docs/_components/GammaAPIPage.client'
import { openapi } from '@/lib/openapi'

export const GammaAPIPage = createAPIPage(openapi, {
  client,
})
