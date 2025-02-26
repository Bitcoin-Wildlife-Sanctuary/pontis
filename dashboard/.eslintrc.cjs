/* eslint-env node */

const {node: restrictedImports} = require('@uniswap/eslint-config/restrictedImports');
require('@uniswap/eslint-config/load');

/**
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  extends: ['@uniswap/eslint-config/react'],
  plugins: [],

  overrides: [
    {
      files: ['**/*'],
      rules: {
        'prettier/prettier': ['error', {semi: true}],
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-restricted-imports': ['error', restrictedImports],
        'no-restricted-syntax': [
          'error',
          {
            selector: ':matches(ExportAllDeclaration)',
            message: 'Barrel exports bloat the bundle size by preventing tree-shaking.',
          },
        ],
        'no-restricted-imports': ['error'],
        'react/prop-types': 'off',
      },
    },
  ],
};
