import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'public/**/*',
    'src/components/ui/**',
  ],
  treatConfigHintsAsErrors: false,
}

export default config
