import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: 'docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
})

export default defineConfig()
