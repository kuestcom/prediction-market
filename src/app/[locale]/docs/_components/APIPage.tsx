import { configDefault } from 'fumadocs-core/highlight'
import { createAPIPage } from 'fumadocs-openapi/ui'
import client from '@/app/[locale]/docs/_components/APIPage.client'
import { openapi } from '@/lib/openapi'

export const APIPage = createAPIPage(openapi, {
  client,
  shiki: configDefault,
})
