import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'next-env.d.ts',
    'public/**/*',
    'scripts/**',
    'src/components/ui/**',
    'src/lib/image/**',
    'src/lib/site-url.js',
    'vitest.setup.ts',
  ],
  ignoreDependencies: [
    'date-fns',
  ],
  treatConfigHintsAsErrors: false,
  rules: {
    unlisted: 'off',
  },
}

export default config
