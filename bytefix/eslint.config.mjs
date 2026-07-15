import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['out/**', 'node_modules/**']
  },
  tseslint.configs.base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    rules: {}
  }
]
