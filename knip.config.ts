import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'public/**/*',
    'scripts/**',
    'src/lib/db/schema/**',
    'src/components/ui/**',
  ],
  treatConfigHintsAsErrors: false,
  rules: {
    unlisted: 'off',
  },
}

export default config
