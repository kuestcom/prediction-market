import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'public/**/*',
    'scripts/**',
    'src/lib/db/schema/**',
    'src/components/ui/**',
  ],
  ignoreBinaries: ['lint-staged', 'test', 'build'],
  ignoreDependencies: ['lint-staged'],
  treatConfigHintsAsErrors: false,
  rules: {
    binaries: 'off',
    unlisted: 'off',
  },
}

export default config
