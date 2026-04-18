import antfu from '@antfu/eslint-config'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'

export default antfu({
  react: true,
  nextjs: true,
  ignores: ['tests'],
}, {
  plugins: {
    'better-tailwindcss': eslintPluginBetterTailwindcss,
    'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
  },
  rules: {
    ...reactYouMightNotNeedAnEffect.configs.recommended.rules,
    ...eslintPluginBetterTailwindcss.configs['recommended-error'].rules,
    'node/prefer-global/process': 'off',
    'no-console': 'off',
    'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
    'curly': ['error', 'all'],
    'react/no-array-index-key': 'off',
    'react-dom/no-dangerously-set-innerhtml': 'off',
    'react-refresh/only-export-components': 'off',
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
