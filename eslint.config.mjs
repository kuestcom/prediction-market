import antfu from '@antfu/eslint-config'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'

export default antfu({
  react: true,
  nextjs: true,
  ignores: ['AGENTS.md'],
}, {
  plugins: {
    'better-tailwindcss': eslintPluginBetterTailwindcss,
  },
  rules: {
    ...eslintPluginBetterTailwindcss.configs['recommended-error'].rules,
    'node/prefer-global/process': 'off',
    'no-console': 'off',
    'curly': ['error', 'all'],
    'e18e/prefer-static-regex': 'off',
    'react/no-array-index-key': 'off',
    'react-dom/no-dangerously-set-innerhtml': 'off',
    'react-refresh/only-export-components': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
    'func-style': ['error', 'declaration', { allowArrowFunctions: false }],
    'better-tailwindcss/enforce-consistent-line-wrapping': ['error', {
      group: 'newLine',
      preferSingleLine: true,
      printWidth: 120,
    }],
  },
  settings: {
    'better-tailwindcss': {
      tailwindConfig: './src/app/globals.css',
    },
  },
})
