import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'public/**/*',
    'src/components/ui/**',
  ],
  treatConfigHintsAsErrors: false,
  rules: {
    unlisted: 'off',
  },
}

export default config
