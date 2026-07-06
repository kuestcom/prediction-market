'use client'

import { createOpenAPIPage } from 'fumadocs-openapi/ui'
import { OpenAPIPlaygroundResult } from '@/app/[locale]/docs/_components/OpenAPIPlaygroundResult'

export default createOpenAPIPage({
  playground: {
    components: {
      ResultDisplay: OpenAPIPlaygroundResult,
    },
  },
})
