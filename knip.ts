import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'docs.config.ts',
    'next-env.d.ts',
    'public/**/*',
    'scripts/**',
    'src/components/ui/**',
    'src/lib/image/**',
    'vitest.setup.ts',
  ],
  ignoreDependencies: [
    'date-fns',
    'postcss',
    'tailwindcss',
  ],
  rules: {
    files: 'error',
    dependencies: 'error',
    exports: 'warn',
  },
}

export default config
