'use client'

import { defineClientConfig } from 'fumadocs-openapi/ui/client'
import { OpenAPIPlaygroundResult } from '@/app/[locale]/docs/_components/OpenAPIPlaygroundResult'

export default defineClientConfig({
  playground: {
    components: {
      ResultDisplay: OpenAPIPlaygroundResult,
    },
  },
})
